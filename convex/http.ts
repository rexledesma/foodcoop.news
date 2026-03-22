import { httpRouter } from 'convex/server';

import { authComponent, createAuth } from './auth';
import { notifyAllowedUsersHttp } from './notifications';

const http = httpRouter();
authComponent.registerRoutes(http, createAuth);
http.route({
  path: '/notify-allowed-users',
  method: 'POST',
  handler: notifyAllowedUsersHttp,
});
export default http;
