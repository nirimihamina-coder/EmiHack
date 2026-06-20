import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Report } from './schemas/report.schema';

@WebSocketGateway({ cors: { origin: '*' } })
export class ReportsGateway {
  @WebSocketServer()
  server!: Server;

  handleNewReport(report: Report) {
    this.server.emit('newReport', report);
  }

  handleReportUpdated(report: Report) {
    this.server.emit('reportUpdated', report);
  }

  handleReportsExpired(count: number) {
    this.server.emit('reportsExpired', { count });
  }
}
