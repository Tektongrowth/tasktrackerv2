import { describe, it, expect, vi } from 'vitest';

// Mock express request/response/next
function mockReq(overrides: Record<string, any> = {}) {
  return {
    isAuthenticated: vi.fn(() => false),
    user: undefined,
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockNext() {
  return vi.fn();
}

// Import after mocks are set up — these are pure middleware functions
// that don't import prisma at the top level
import { isAuthenticated, isAdmin, hasPermission } from '../src/middleware/auth.js';

describe('isAuthenticated middleware', () => {
  it('should be a function', () => {
    expect(typeof isAuthenticated).toBe('function');
  });

  it('should return 401 when user is not authenticated', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    isAuthenticated(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next when user is authenticated', () => {
    const req = mockReq({ isAuthenticated: vi.fn(() => true) });
    const res = mockRes();
    const next = mockNext();

    isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('isAdmin middleware', () => {
  it('should be a function', () => {
    expect(typeof isAdmin).toBe('function');
  });

  it('should return 403 when user is not admin', () => {
    const req = mockReq({
      isAuthenticated: vi.fn(() => true),
      user: { role: 'member' },
    });
    const res = mockRes();
    const next = mockNext();

    isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
  });

  it('should call next when user is admin', () => {
    const req = mockReq({
      isAuthenticated: vi.fn(() => true),
      user: { role: 'admin' },
    });
    const res = mockRes();
    const next = mockNext();

    isAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('hasPermission middleware', () => {
  it('should return a function', () => {
    expect(typeof hasPermission('some_perm')).toBe('function');
  });

  it('should return 401 when no user', () => {
    const middleware = hasPermission('manage_tasks');
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should allow admins regardless of permission', () => {
    const middleware = hasPermission('manage_tasks');
    const req = mockReq({ user: { role: 'admin', permissions: {} } });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow users with the specific permission', () => {
    const middleware = hasPermission('manage_tasks');
    const req = mockReq({
      user: { role: 'member', permissions: { manage_tasks: true } },
    });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny users without the specific permission', () => {
    const middleware = hasPermission('manage_tasks');
    const req = mockReq({
      user: { role: 'member', permissions: {} },
    });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Permission denied' });
  });
});
