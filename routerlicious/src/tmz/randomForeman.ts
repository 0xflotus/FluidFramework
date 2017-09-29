import * as winston from "winston";
import * as socketStorage from "../socket-storage";
import { BaseForeman } from "./baseForeman";
import { IDocumentWork, IForeman, IWorkerDetail } from "./messages";

/**
 * Worker that picks worker randomly.
 */
export class RandomForeman extends BaseForeman implements IForeman {

    constructor() {
        super();
    }

    public assignWork(workToDo: IDocumentWork[]): Array<Promise<void>> {
        const workPromises = [];
        let workers: any;
        for (let work of workToDo) {
            switch (work.work.workerType) {
                case "server":
                    workers = this.manager.getActiveServerWorkers();
                    workPromises.push(this.assignOne(work.docId, work.work.workType, workers));
                    break;
                case "client":
                    workers = this.manager.getActiveClientWorkers();
                    workPromises.push(this.assignOne(work.docId, work.work.workType, workers));
                    break;
                case "both":
                    workers = this.manager.getActiveWorkers();
                    workPromises.push(this.assignOne(work.docId, work.work.workType, workers));
                    break;
                default:
                    throw new Error("Unknown worker type!");
            }
        }
        return workPromises;
    }

    private assignOne(id: string, workType: string, workers: IWorkerDetail[]): Promise<void> {
        const candidates = [];
        // Check how many workers are on board and make a candiate array.
        for (let worker of workers) {
            worker.socket.emit("ReadyObject", worker.worker.clientId, id, workType,
                (error, ack: socketStorage.IWorker) => {
                    if (ack) {
                        candidates.push(worker);
                    } else {
                        winston.error(error);
                    }
            });
        }
        return new Promise<any>((resolve, reject) => {
            setTimeout(() => {
                if (candidates.length > 0) {
                    const pickedWorker = candidates[Math.floor(Math.random() * candidates.length)];
                    winston.info(`Picked worker ${pickedWorker.worker.clientId} for work ${workType} document ${id}`);
                    pickedWorker.socket.emit("TaskObject", pickedWorker.worker.clientId, id, workType,
                        (error, ack: socketStorage.IWorker) => {
                            if (ack) {
                                this.manager.assignWork(pickedWorker, id, workType);
                                resolve();
                            } else {
                                winston.error(error);
                                reject();
                            }
                    });
                } else {
                    reject();
                }
            }, this.ackTimeout);
        });
    }
}
