import { create as createBasicSubject } from '@liquid-bricks/shared-providers/subject/create/basic'

import { Errors } from '../../../../errors.js'
import { domain } from '../../../../../domain/index.js'
import { STATE_EDGE_LABEL_BY_TYPE } from './constants.js'

const INJECTS_INTO_EDGE_BY_TYPE = Object.freeze({
  data: [
    { edgeLabel: domain.edge.injects_into.data_data.constants.LABEL, targetType: 'data' },
    { edgeLabel: domain.edge.injects_into.data_task.constants.LABEL, targetType: 'task' },
  ],
  task: [
    { edgeLabel: domain.edge.injects_into.task_data.constants.LABEL, targetType: 'data' },
    { edgeLabel: domain.edge.injects_into.task_task.constants.LABEL, targetType: 'task' },
  ],
})

async function findComponentIdForNode({ g, nodeId, type }) {
  const edgeLabel = type === 'task'
    ? domain.edge.has_task.component_task.constants.LABEL
    : domain.edge.has_data.component_data.constants.LABEL
  const [componentId] = await g.V(nodeId).in(edgeLabel).id()
  return componentId
}

async function findImportPath({ g, fromComponentId, toComponentId }) {
  const visited = new Set()
  const queue = [{ componentId: fromComponentId, path: [] }]

  while (queue.length) {
    const { componentId, path } = queue.shift()
    if (componentId === toComponentId) return path
    if (visited.has(componentId)) continue
    visited.add(componentId)

    const edgeIds = await g.V(componentId)
      .outE(domain.edge.has_import.component_component.constants.LABEL)
      .id()

    for (const edgeId of edgeIds ?? []) {
      const [edgeValues] = await g.E(edgeId).valueMap('alias')
      const aliasValues = edgeValues?.alias ?? edgeValues
      const alias = Array.isArray(aliasValues) ? aliasValues[0] : aliasValues
      const [nextComponentId] = await g.E(edgeId).inV().id()
      if (!alias || !nextComponentId) continue
      queue.push({ componentId: nextComponentId, path: [...path, alias] })
    }
  }
  return null
}

async function findInstanceForImportPath({ g, rootInstanceVertexId, aliasPath }) {
  let currentInstanceVertexId = rootInstanceVertexId
  for (const alias of aliasPath ?? []) {
    const [edgeId] = await g
      .V(currentInstanceVertexId)
      .outE(domain.edge.uses_import.componentInstance_componentInstance.constants.LABEL)
      .has('alias', alias)
      .id()
    if (!edgeId) return null
    const [nextInstanceVertexId] = await g.E(edgeId).inV().id()
    if (!nextInstanceVertexId) return null
    currentInstanceVertexId = nextInstanceVertexId
  }
  return currentInstanceVertexId
}

async function findStateEdgeForNode({ g, stateMachineId, targetNodeId, targetStateEdgeLabel }) {
  const [stateEdgeId] = await g
    .V(stateMachineId)
    .outE(targetStateEdgeLabel)
    .filter(_ => _.inV().has('id', targetNodeId))
    .id()
  return stateEdgeId
}

export async function publishInjectedResultComputedEvents({ scope, rootCtx: { g, natsContext } }) {
  const { handlerDiagnostics, instanceId, instanceVertexId, stateMachineId, stateEdgeId, stateEdgeLabel, type, result } = scope

  const [providedNodeId] = await g
    .V(stateMachineId)
    .outE(stateEdgeLabel)
    .has('id', stateEdgeId)
    .inV()
    .id()

  handlerDiagnostics.require(
    providedNodeId,
    Errors.PRECONDITION_INVALID,
    `${type} state edge ${stateEdgeId} not associated with instance ${instanceId}`,
    { instanceId, stateEdgeId, type }
  )

  const providedComponentId = await findComponentIdForNode({ g, nodeId: providedNodeId, type })
  handlerDiagnostics.require(
    providedComponentId,
    Errors.PRECONDITION_INVALID,
    `Provided component missing`,
    { instanceId, stateEdgeId, type }
  )

  const injectsIntoEdges = INJECTS_INTO_EDGE_BY_TYPE[type]
  if (!injectsIntoEdges?.length) return

  const resultComputedSubject = createBasicSubject()
    .env('prod')
    .ns('component-service')
    .entity('componentInstance')
    .channel('evt')
    .action('result_computed')
    .version('v1')
    .build()

  const publishedTargets = new Set()

  for (const { edgeLabel, targetType } of injectsIntoEdges) {
    const targetNodeIds = await g.V(providedNodeId).out(edgeLabel).id()
    if (!targetNodeIds?.length) continue

    const targetStateEdgeLabel = STATE_EDGE_LABEL_BY_TYPE[targetType]

    for (const targetNodeId of targetNodeIds) {
      const targetComponentId = await findComponentIdForNode({ g, nodeId: targetNodeId, type: targetType })
      handlerDiagnostics.require(
        targetComponentId,
        Errors.PRECONDITION_INVALID,
        `Injected target component missing`,
        { instanceId, targetNodeId, targetType, fromType: type }
      )

      let targetInstanceVertexId = instanceVertexId
      if (targetComponentId !== providedComponentId) {
        const importPath = await findImportPath({
          g,
          fromComponentId: providedComponentId,
          toComponentId: targetComponentId,
        })

        handlerDiagnostics.require(
          importPath,
          Errors.PRECONDITION_INVALID,
          `Injected target component not reachable via imports`,
          { instanceId, targetNodeId, targetType, fromType: type }
        )

        const resolvedInstanceVertexId = await findInstanceForImportPath({
          g,
          rootInstanceVertexId: instanceVertexId,
          aliasPath: importPath,
        })

        handlerDiagnostics.require(
          resolvedInstanceVertexId,
          Errors.PRECONDITION_INVALID,
          `Injected target instance missing for import path`,
          { instanceId, targetNodeId, targetType, fromType: type, importPath }
        )

        targetInstanceVertexId = resolvedInstanceVertexId
      }

      const [targetInstanceMap] = await g.V(targetInstanceVertexId).valueMap('instanceId')
      const targetInstanceValues = targetInstanceMap?.instanceId ?? targetInstanceMap
      const targetInstanceId = Array.isArray(targetInstanceValues) ? targetInstanceValues[0] : targetInstanceValues

      handlerDiagnostics.require(
        targetInstanceId,
        Errors.PRECONDITION_INVALID,
        `Injected target instanceId missing`,
        { instanceId, targetInstanceVertexId, targetNodeId, targetType, fromType: type }
      )

      const [targetStateMachineId] = await g
        .V(targetInstanceVertexId)
        .out(domain.edge.has_stateMachine.componentInstance_stateMachine.constants.LABEL)
        .id()

      handlerDiagnostics.require(
        targetStateMachineId,
        Errors.PRECONDITION_INVALID,
        `Injected target stateMachine missing`,
        { instanceId, targetInstanceVertexId, targetNodeId, targetType, fromType: type }
      )

      const targetStateEdgeId = await findStateEdgeForNode({
        g,
        stateMachineId: targetStateMachineId,
        targetNodeId,
        targetStateEdgeLabel,
      })
      handlerDiagnostics.require(
        targetStateEdgeId,
        Errors.PRECONDITION_INVALID,
        `Injected target ${targetType} not associated with instance ${targetInstanceId}`,
        { instanceId: targetInstanceId, targetNodeId, targetType, fromType: type }
      )

      const targetKey = `${targetInstanceId}:${targetStateEdgeId}`
      if (publishedTargets.has(targetKey) || (targetInstanceId === instanceId && targetStateEdgeId === stateEdgeId)) continue
      publishedTargets.add(targetKey)

      const [targetValues] = await g.V(targetNodeId).valueMap('name')
      const targetNameValues = targetValues?.name ?? targetValues
      const targetName = Array.isArray(targetNameValues) ? targetNameValues[0] : targetNameValues
      handlerDiagnostics.require(
        typeof targetName === 'string' && targetName.length,
        Errors.PRECONDITION_INVALID,
        `Injected target name missing`,
        { instanceId: targetInstanceId, targetNodeId, targetType, fromType: type }
      )

      await natsContext.publish(
        resultComputedSubject,
        JSON.stringify({
          data: {
            instanceId: targetInstanceId,
            stateId: targetStateEdgeId,
            name: targetName,
            type: targetType,
            result,
          }
        })
      )
    }
  }
}
