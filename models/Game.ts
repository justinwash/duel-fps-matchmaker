import { v4 as uuid } from 'uuid';

export default interface Game {
  id: string;
  playerIds: uuid[];
  serverId?: uuid;
  serverAddress?: string;
  status: string;
}
