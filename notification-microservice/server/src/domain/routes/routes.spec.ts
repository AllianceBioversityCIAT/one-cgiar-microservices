import { routes } from './main.routes';
import { RouteTree } from '@nestjs/core';

describe('Authorization Routes', () => {
  it('should define the correct email route', () => {
    expect(routes).toBeDefined();
    expect(routes[0].path).toBe('api');
    expect((routes[0].children[0] as RouteTree).path).toBe('email');
    expect(typeof (routes[0].children[0] as RouteTree).module).toBe('function');
  });
});
