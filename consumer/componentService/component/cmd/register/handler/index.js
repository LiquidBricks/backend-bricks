import { attachImports } from './attachImports.js'
import { createDataTaskResources } from './createDataTaskResources.js'
import { attachDataTaskDependencies } from './attachDataTaskDependencies.js'
import { attachDataTaskInjections } from './attachDataTaskInjections.js'

export async function handler({ rootCtx: { g, dataMapper }, scope: { handlerDiagnostics, component } }) {
  const { hash, name: compName } = component
  const { id: componentVID } = await dataMapper.vertex.component.create({ hash, name: compName })
  await attachImports({ rootCtx: { g, dataMapper }, scope: { handlerDiagnostics, component, componentVID } })

  const dependencyList = await createDataTaskResources({
    rootCtx: { dataMapper },
    scope: { handlerDiagnostics, component, componentVID },
  })

  await attachDataTaskDependencies({
    dependencyList,
    handlerDiagnostics,
    g,
    componentVID,
    compName,
    hash,
    dataMapper,
  })

  await attachDataTaskInjections({
    dependencyList,
    handlerDiagnostics,
    g,
    componentVID,
    compName,
    hash,
    dataMapper,
  })
}
