import { v4 as uuid } from 'uuid';

export default interface Game {
  id: string;
  player_ids: uuid[];
  status: string;
}
