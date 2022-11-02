import Player from '../models/Player';
import Game from '../models/Game';
import { v4 as uuid } from 'uuid';
import AWSService from '../services/AWSService';

export default class QueueController {
  _awsService = new AWSService();
  players: Map<uuid, Player> = new Map();
  queue: uuid[] = [];
  games: Map<uuid, Game> = new Map();

  startTimer() {
    setInterval(() => {
      this.queue.length >= 2 ? this.startAvailableMatches() : null;
    }, 10000);
  }

  connect(req, res) {
    let player: Player = {
      id: uuid(),
      status: 'idle',
      timeout: setTimeout(() => this.timeout(player), 60000),
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

    // Testing
    this.addPlayerToQueue(player);
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
    return Math.ceil((timeout._idleStart + timeout._idleTimeout) / 1000 - process.uptime());
  }

  resetTimeout(player) {
    clearTimeout(player.timeout);
    player.timeout = setTimeout(() => this.timeout(player), 60000);
  }

  timeout(player) {
    this.removePlayerFromQueue(player);

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
    var playerToAdd = this.queue.find((p) => p == player.id);

    if (!playerToAdd) {
      this.queue.push(player.id);
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

    if ((player && player.status == 'match found') || player.status == 'server started') {
      res.json({
        request: 'getQueueStatus',
        success: true,
        message: player.status,
        data: {
          player: {
            ...player,
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
        console.log('queue: ', this.queue);
        console.log('players map: ', this.players);
        this.queue.forEach((playerId, index) => {
          console.log('playerId: ', playerId);
          console.log('player: ', this.players.get(playerId));
          let player1 = this.players.get(playerId);
          let player2 = this.players.get(this.queue[index + 1]);

          if (
            player1 &&
            player2 &&
            this.getTimeUntilDisconnect(player1.timeout) >= 50 &&
            this.getTimeUntilDisconnect(player2.timeout) >= 50
          ) {
            player1.status = 'match found';
            player2.status = 'match found';
            this.queue.splice(index, 2);

            this._awsService.createNewServer((serverId) => {
              console.log('Created new server via _awsService: ', serverId);
              player1.status = 'server started';
              player2.status = 'server started';

              var newGame: Game = {
                id: uuid(),
                playerIds: [player1.id, player2.id],
                serverId: serverId,
                serverAddress: this._awsService.serverTasks.get(serverId).publicIp,
                status: 'running',
              };

              this.games.set(newGame.id, newGame);

              console.log('Created game for players: ', newGame.playerIds);
              console.log('Game info: ', newGame);

              player1.game = newGame;
              player2.game = newGame;
            });
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

  endGame(req, res) {
    console.log('Game ', req.query.gameId, ' ended');
    var game = this.games.get(req.query.gameId);
    var stopTaskResponse = this._awsService.destroyServer(game.serverId);

    res.json({
      request: 'endGame',
      success: true,
      message: 'task stopped',
      data: stopTaskResponse,
    });
  }
}
