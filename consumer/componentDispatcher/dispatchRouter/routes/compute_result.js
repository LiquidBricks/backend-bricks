import { decodeData, ackMessage, acknowledgeReceipt } from '../../../componentProvider/router/middleware.js'
import { create as createSubject } from '@liquid-bricks/shared-providers/subject/create/basic'
import { Codes } from '../../../componentProvider/codes.js'
import { s } from '@liquid-bricks/shared-providers/component/builder/helper'

export const path = { channel: 'exec', entity: 'component', action: 'compute_result' }
export const spec = {
  decode: [
    decodeData(['instanceId', 'deps', 'componentHash', 'name', 'type']),
  ],
  pre: [
    validateExecutionRequest,
  ],
  handler: () => { },
  post: [
    publishComputedResult,
    ackMessage,
  ],
}

function validateExecutionRequest({ scope, rootCtx: { diagnostics, connectionRegistry } }) {
  const { instanceId, type, componentHash, name, deps } = scope;
  // diagnostics.require(typeof instanceId === 'string' && instanceId.length, Codes.PRECONDITION_REQUIRED, 'instanceId is required', { field: 'instanceId' });
  // diagnostics.require(typeof componentHash === 'string' && componentHash.length, Codes.PRECONDITION_REQUIRED, 'componentHash is required', { field: 'componentHash' });
  // diagnostics.require(typeof name === 'string' && name.length, Codes.PRECONDITION_REQUIRED, `${type} name is required`, { field: 'name' });
  const [[k, { publish }]] = connectionRegistry.entries()

  const subject = createSubject()
    .env('prod')
    .ns('component-service')
    .entity('component')
    .channel('exec')
    .action(`compute_result`)
    .version('v1')
    .build();
  publish(subject, { componentHash, name, type, instanceId, deps })
}



async function publishComputedResult({ scope, rootCtx: { natsContext, diagnostics } }) {
  // const { instanceId, result, type, name } = scope;
  // const subject = createSubject()
  //   .env('prod')
  //   .ns('component-service')
  //   .entity('componentInstance')
  //   .channel('evt')
  //   .action(`result_computed`)
  //   .version('v1');

  // await natsContext.publish(
  //   subject.build(),
  //   JSON.stringify({ data: { instanceId, name, type, result } })
  // );
}
