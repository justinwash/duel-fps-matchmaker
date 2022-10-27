import { v4 as uuid } from 'uuid';

export default interface Player {
  id: uuid;
  status: string;
  timeout: any;
}
