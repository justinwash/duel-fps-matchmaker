import { ECSClient, RunTaskCommand, DescribeTasksCommand, UpdateClusterCommandInput } from '@aws-sdk/client-ecs';
import { EC2Client, DescribeNetworkInterfacesCommand } from '@aws-sdk/client-ec2';

import { v4 as uuid } from 'uuid';

export default class AWSService {
  private ecsClient = new ECSClient({ region: 'us-east-1' });
  private ec2Client = new EC2Client({ region: 'us-east-1' });

  public serverTasks: Map<uuid, any> = new Map();

  private createServerCommand = new RunTaskCommand({
    taskDefinition: 'duel-fps:11',
    cluster: 'duel-fps',
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ['subnet-b092c0d7', 'subnet-6feab533', 'subnet-3cc89112', 'subnet-7535544b', 'subnet-63e1f56c', 'subnet-9508ead8'],
        securityGroups: ['sg-6557d93f'],
        assignPublicIp: 'ENABLED',
      },
    },
  });

  private getTaskInfoCommand(taskId) {
    return new DescribeTasksCommand({
      cluster: 'duel-fps',
      tasks: [taskId],
    });
  }

  private getNetworkInfoCommand(networkInterfaceId) {
    return new DescribeNetworkInterfacesCommand({
      NetworkInterfaceIds: [networkInterfaceId],
    });
  }

  public async createNewServer(callback) {
    try {
      var createdTaskResponse = await this.ecsClient.send(this.createServerCommand);
      if (createdTaskResponse) {
        var serverId = uuid();
        this.serverTasks.set(serverId, {
          id: serverId,
          spinUpSecs: 0,
          lastResponse: createdTaskResponse,
          publicIp: null,
        });
        console.log('Spinning up a new server instance!');

        var statusInterval = setInterval(async () => {
          var taskInfoResponse = await this.ecsClient.send(this.getTaskInfoCommand(createdTaskResponse.tasks[0].taskArn));
          if (taskInfoResponse) {
            if (taskInfoResponse.tasks[0]?.lastStatus !== 'RUNNING') {
              var serverTask = this.serverTasks.get(serverId);
              serverTask.spinUpSecs += 5;
              serverTask.lastResponse = taskInfoResponse;
              this.serverTasks.set(serverId, serverTask);
            } else if (taskInfoResponse.tasks[0]?.lastStatus === 'RUNNING') {
              clearInterval(statusInterval);

              var serverTask = this.serverTasks.get(serverId);
              serverTask.spinUpSecs += 5;
              serverTask.lastResponse = taskInfoResponse;
              this.serverTasks.set(serverId, serverTask);

              console.log('Server ', serverId, ' ready. Spin up took ', serverTask.spinUpSecs, ' seconds');

              var networkInterfaceId = taskInfoResponse.tasks[0]?.attachments[0]?.details.find(
                (x) => x.name === 'networkInterfaceId'
              ).value;
              if (!networkInterfaceId) throw 'networkInterfaceId not found';

              var networkInfoResponse = await this.ec2Client.send(this.getNetworkInfoCommand(networkInterfaceId));
              if (networkInfoResponse) {
                var serverTask = this.serverTasks.get(serverId);
                serverTask.publicIp = networkInfoResponse.NetworkInterfaces[0]?.Association?.PublicIp;
                this.serverTasks.set(serverId, serverTask);

                console.log('Server IP: ', networkInfoResponse.NetworkInterfaces[0]?.Association?.PublicIp);

                callback(serverId);
              }
            } else if (taskInfoResponse.tasks[0]?.lastStatus === 'STOPPED') {
              clearInterval(statusInterval);
              console.log('Something went wrong starting the server :(');
            }
          }
        }, 5000);
      }
    } catch (err) {
      console.log(err);
    }
  }
}
