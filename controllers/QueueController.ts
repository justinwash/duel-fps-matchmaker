import Player from '../models/Player';
import Game from '../models/Game';
import { v4 as uuid } from 'uuid';

export default class QueueController {
  players: Map<uuid, Player> = new Map();
  queue: uuid[] = [];
  games: Game[] = [];

  startTimer() {
    setInterval(() => {
      this.queue.length >= 2 ? this.startAvailableMatches() : null;
    }, 10000);
  }

  connect(req, res) {
    let player: Player = {
      id: uuid(),
      status: 'idle',
      timeout: setTimeout(() => this.timeout(player), 300000),
    };

    this.players.set(player.id, player);

    res.json({
      request: 'connect',
      success: true,
      message: `player connected: ${player.id}`,
      data: {
        id: player.id,
        status: player.status,
        timeout: this.getTimeUntilDisconnect(player.timeout),
      },
    });

    console.log(`player connected: ${player.id}`);
  }

  info(req, res) {
    var player = this.players.get(req.query.playerId);
    if (player) {
      res.json({
        request: 'info',
        success: true,
        message: `player information: ${player.id}`,
        data: {
          id: player.id,
          status: player.status,
          timeout: this.getTimeUntilDisconnect(player.timeout),
        },
      });
    } else {
      res.json({
        request: 'info',
        success: false,
        message: `player not found: ${req.query.playerId}`,
      });
    }

    this.resetTimeout(player);
  }

  disconnect(req, res) {
    var playerToDisconnect = this.players.get(req.query.playerId);

    if (playerToDisconnect) {
      this.removePlayerFromQueue(playerToDisconnect);
      if (this.players.delete(playerToDisconnect.id)) {
        console.log(`player disconnected: ${req.query.playerId}`);
        res.json({
          request: 'disconnect',
          success: true,
          message: `disconnected: ${req.query.playerId}`,
        });
      } else {
        res.json({
          request: 'disconnect',
          success: false,
          message: `error disconnecting player: ${req.query.playerId}`,
        });
      }
    } else {
      res.json({
        request: 'disconnect',
        success: false,
        message: `not connected: ${req.query.playerId}`,
      });
    }
  }

  ping(req, res) {
    var player = this.players.get(req.query.playerId);
    if (player) {
      this.resetTimeout(player);
      res.json({
        request: 'ping',
        success: true,
        message: `connection ok: ${player.id}`,
        data: {
          timeout: this.getTimeUntilDisconnect(player.timeout),
        },
      });
    } else {
      res.json({
        request: 'ping',
        success: false,
        message: `timed out. pls reconnect.`,
      });
    }
  }

  getTimeUntilDisconnect(timeout) {
    return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000);
  }

  resetTimeout(player) {
    clearTimeout(player.timeout);
    player.timeout = setTimeout(() => this.timeout(player), 300000);
  }

  timeout(player) {
    if (this.players.has(player.id)) {
      this.players.delete(player.id);
      console.log(`player timed out: ${player.id}`);
    }
  }

  joinQueue(req, res) {
    var playerToAdd = this.players.get(req.query.playerId);

    if (playerToAdd) {
      playerToAdd.status = 'in queue';
      if (this.addPlayerToQueue(playerToAdd)) {
        res.json({
          request: 'joinQueue',
          success: true,
          message: `added to queue: ${playerToAdd.id}`,
        });
        console.log(`player added to queue: ${playerToAdd.id}`);
        this.resetTimeout(playerToAdd);
      } else {
        res.json({
          request: 'joinQueue',
          success: false,
          message: `already in queue: ${playerToAdd.id}`,
        });
      }
    } else {
      res.json({
        request: 'joinQueue',
        success: false,
        message: `not connected: ${req.query.playerId}`,
      });
    }
  }

  addPlayerToQueue(player) {
    var playerToAdd = this.queue.find((p) => p == player);

    if (!playerToAdd) {
      player.matchFound = false;
      this.queue.push(player);
      return true;
    } else {
      return false;
    }
  }

  exitQueue(req, res) {
    var playerToRemove = this.players.get(req.query.playerId);

    if (playerToRemove) {
      if (this.removePlayerFromQueue(playerToRemove)) {
        res.json({
          request: 'exitQueue',
          success: true,
          message: `removed from queue: ${playerToRemove.id}`,
        });
        console.log(`player removed from queue: ${playerToRemove.id}`);
        this.resetTimeout(playerToRemove);
      } else {
        res.json({
          request: 'exitQueue',
          success: false,
          message: `not in queue: ${playerToRemove.id}`,
        });
      }
    } else {
      res.json({
        request: 'exitQueue',
        success: false,
        message: `not connected: ${req.query.playerId}`,
      });
    }
  }

  removePlayerFromQueue(player) {
    var playerToRemove = this.queue.indexOf(player.id);

    if (playerToRemove != -1) {
      this.queue.splice(playerToRemove);
      var removedPlayer = this.players.get(player.id);
      if (removedPlayer) {
        removedPlayer.status = 'idle';
      }
      return true;
    } else {
      return false;
    }
  }

  getQueueStatus(req, res) {
    var player = this.players.get(req.query.playerId);

    if (!player) {
      res.json({
        request: 'getQueueStatus',
        success: false,
        message: `not connected`,
      });
      return;
    }

    if (player && player.status == 'match found') {
      res.json({
        request: 'getQueueStatus',
        success: true,
        message: `match found`,
        data: {
          player: {
            id: player.id,
            status: player.status,
            timeout: this.getTimeUntilDisconnect(player.timeout),
          },
        },
      });

      this.resetTimeout(player);
      return;
    } else if (this.queue.indexOf(player) != -1) {
      res.json({
        request: 'getQueueStatus',
        success: true,
        message: `in queue`,
        data: {
          playersInQueue: this.queue.length,
        },
      });

      this.resetTimeout(player);
      return;
    } else {
      res.json({
        request: 'getQueueStatus',
        success: false,
        message: `not in queue`,
        data: {
          playersInQueue: this.queue.length,
        },
      });
    }
  }

  startAvailableMatches() {
    try {
      if (this.queue.length >= 2) {
        console.log('starting all available matches');
        this.queue.forEach((playerId, index) => {
          let player1 = this.players.get(playerId);
          let player2 = this.players.get(this.queue[index + 1]);

          if (player1 && player2) {
            player1.status = 'match found';
            player2.status = 'match found';
            this.queue.splice(index, 2);
          }
        });
      } else {
        console.log('not enough players to start a match');
        return 'fail';
      }
    } catch (err) {
      console.log('error starting matches', err);
    }
  }
}
