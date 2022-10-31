import { v4 as uuid } from 'uuid';

export default interface Game {
  id: string;
  playerIds: uuid[];
  serverMetadata: Object;
  startTime: number;
  status: string;
}
