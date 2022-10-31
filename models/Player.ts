import { v4 as uuid } from 'uuid';
import Game from './Game';

export default interface Player {
  id: uuid;
  status: string;
  game?: Game;
  timeout: any;
}
