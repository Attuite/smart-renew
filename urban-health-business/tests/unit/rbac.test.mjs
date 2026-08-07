import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountableActor,
  authorizeRequest,
  rbacCapability
} from '../../server/security/rbac.mjs';

test('RBAC required mode distinguishes unauthenticated, denied and project-isolated requests', () => {
  assert.throws(
    () => authorizeRequest({ headers: {} }, 'gis.view', {
      mode: 'required',
      projectId: 'PRJ-1'
    }),
    (error) => error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED'
  );
  const request = {
    headers: {
      'x-authenticated-user': 'user-1',
      'x-authenticated-name': '真实用户',
      'x-authenticated-roles': 'gis-viewer',
      'x-authenticated-projects': 'PRJ-1'
    }
  };
  assert.throws(
    () => authorizeRequest(request, 'gis.route.manage', {
      mode: 'required',
      projectId: 'PRJ-1'
    }),
    (error) => error.status === 403 && error.code === 'GIS_PERMISSION_DENIED'
  );
  assert.throws(
    () => authorizeRequest(request, 'gis.view', {
      mode: 'required',
      projectId: 'PRJ-2'
    }),
    (error) => error.status === 403 && error.code === 'GIS_PROJECT_ACCESS_DENIED'
  );
  const identity = authorizeRequest(request, 'gis.view', {
    mode: 'required',
    projectId: 'PRJ-1'
  });
  assert.equal(accountableActor(identity, '伪造人员'), '真实用户');
});

test('local disabled mode stays explicit and never claims production enforcement', () => {
  const identity = authorizeRequest({ headers: {} }, 'gis.map_snapshot.create', {
    mode: 'disabled'
  });
  assert.equal(identity.authenticated, false);
  assert.equal(accountableActor(identity, '本地操作员'), '本地操作员');
  assert.equal(rbacCapability({ URBAN_HEALTH_AUTH_MODE: 'disabled' }).enforced, false);
});
