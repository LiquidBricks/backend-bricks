import { jetstream, jetstreamManager } from '@nats-io/jetstream'
import { Kvm } from '@nats-io/kv'
import { connect } from '@nats-io/transport-node'

const connectionTemplateObject = {
  client: null,
  jetstream: null,
  jetstreamManager: null,
  Kvm: null,
}
const allConnections = []

export const connection = new Proxy(connectionTemplateObject, {
  get(_target, prop, thisProxy) {
    switch (prop) {
      case "client":
        return async (servers) => {
          if (_target.client)
            return _target.client
          _target.client = await connect({ servers });
          allConnections.push({ client: _target.client })
          return _target.client;
        };
      case "jetstream":
        return async (servers) => {
          _target.jetstream ||= jetstream(await thisProxy.client());
          return _target.jetstream;
        };
      case "jetstreamManager":
        return async (servers) => {
          _target.jetstreamManager ||= await jetstreamManager(await thisProxy.client());
          return _target.jetstreamManager;
        };
      case "Kvm":
        return async (servers) => {
          _target.Kvm ||= new Kvm(await thisProxy.client());
          return _target.Kvm;
        };
      case "publish":
        return async (k, v) => thisProxy.jetstream().then(js => js.publish(k, v))
          .catch(err => console.error('publish uh oh', { err }));
      default:
        return undefined;
    }
  },
});