import { IBus, IMediator, IRequestHandler } from "./types";
import { Mutex, MutexInterface } from "async-mutex";
import nonce from "@/common/nonce";

type HandlersCollection = {
  [command: string]: IRequestHandler<any, any>;
};
type LocksCollection = {
  [correlationId: number]: { release: MutexInterface.Releaser; response?: any };
};

type MessageType = {
  Headers: {
    Type: "REQUEST" | "RESPONSE";
    Command: string;
    CorrelationId: number;
  };
  Body: any;
};

export default class Mediator implements IMediator {
  _bus!: IBus;
  _locks: LocksCollection;
  _handlers: HandlersCollection;

  constructor(bus: IBus) {
    this._locks = {};
    this._handlers = {};
    this._bus = bus;
    this._bus.ReceiveCallback(this.HandleMessage, this);
  }

  AddHandler<REQ, RES>(command: string, handler: IRequestHandler<REQ, RES>): IMediator {
    this._handlers[command] = handler;
    return this;
  }

  async PublishAsync<REQ, RES>(command: string, request: REQ): Promise<RES> {
    const correlationId = nonce();
    const message: MessageType = {
      Headers: {
        Type: "REQUEST",
        Command: command,
        CorrelationId: correlationId,
      },
      Body: request,
    };
    const mutex = new Mutex();
    const release = await mutex.acquire();
    this._locks[correlationId] = { release: release };
    this._bus.Send(message);
    await mutex.waitForUnlock();

    const response = this._locks[correlationId].response;
    if (response == undefined) throw "Response not set";

    delete this._locks[correlationId];

    return response;
  }

  HandleMessage(message: MessageType) {
    if (message.Headers.Type == "REQUEST") return this.HandleRequest(message);
    else if (message.Headers.Type == "RESPONSE") return this.HandleResponse(message);
    else throw `Message type not recognized: ${message.Headers.Type}`;
  }

  async HandleRequest(message: MessageType) {
    const handler = this._handlers[message.Headers.Command];
    if (handler == null) throw `No handler registered for command: ${message.Headers.Command}`;

    const response = await handler.HandleAsync(message.Body);
    const returnMessage: MessageType = {
      Headers: {
        Type: "RESPONSE",
        Command: message.Headers.Command,
        CorrelationId: message.Headers.CorrelationId,
      },
      Body: response,
    };

    this._bus.Send(returnMessage);
  }

  async HandleResponse(message: MessageType) {
    const lockInfo = this._locks[message.Headers.CorrelationId];
    if (lockInfo == null)
      throw `No lock info found for correlationId: ${message.Headers.CorrelationId}`;

    lockInfo.response = message.Body;
    lockInfo.release();
  }
}
