import { domain } from '../../../../../../domain/index.js'

export async function createComponentInstance({ g, dataMapper, componentId, instanceId }) {
  const { id: instanceVertexId } = await dataMapper.vertex.componentInstance.create({ instanceId })
  await dataMapper.edge.instance_of.componentInstance_component.create({ fromId: instanceVertexId, toId: componentId })

  const { id: stateMachineId } = await dataMapper.vertex.stateMachine.create()
  await dataMapper.edge.has_stateMachine.componentInstance_stateMachine.create({ fromId: instanceVertexId, toId: stateMachineId })

  const dataNodeIds = await g.V(componentId)
    .out(domain.edge.has_data.component_data.constants.LABEL)
    .id()
  await Promise.all(
    dataNodeIds.map(nodeId =>
      dataMapper.edge.has_data_state.stateMachine_data.create({ fromId: stateMachineId, toId: nodeId })
    )
  )

  const taskNodeIds = await g.V(componentId)
    .out(domain.edge.has_task.component_task.constants.LABEL)
    .id()
  await Promise.all(
    taskNodeIds.map(taskId =>
      dataMapper.edge.has_task_state.stateMachine_task.create({ fromId: stateMachineId, toId: taskId })
    )
  )

  return { instanceVertexId, stateMachineId }
}
