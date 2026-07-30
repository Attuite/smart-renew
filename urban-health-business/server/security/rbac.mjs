const ROLE_PERMISSIONS = Object.freeze({
  'gis-viewer': ['gis.view'],
  'gis-editor': [
    'gis.view',
    'gis.boundary.edit',
    'gis.issue.geometry.edit',
    'gis.photo.geometry.edit',
    'gis.analysis.run'
  ],
  'gis-manager': [
    'gis.view',
    'gis.boundary.edit',
    'gis.issue.geometry.edit',
    'gis.photo.geometry.edit',
    'gis.route.manage',
    'gis.poi.review',
    'gis.analysis.run',
    'gis.map_snapshot.create',
    'gis.audit.view'
  ],
  admin: ['*']
});

function authError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function headerList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function authenticationMode(env = process.env) {
  return String(env.URBAN_HEALTH_AUTH_MODE || 'disabled').toLowerCase() === 'required'
    ? 'required'
    : 'disabled';
}

export function authenticateRequest(req, options = {}) {
  const mode = options.mode || authenticationMode(options.env);
  if (mode === 'disabled') {
    return {
      mode,
      authenticated: false,
      userId: null,
      displayName: null,
      roles: [],
      permissions: new Set(),
      projectIds: new Set()
    };
  }
  const userId = String(req?.headers?.['x-authenticated-user'] || '').trim().slice(0, 160);
  if (!userId) {
    throw authError('当前请求未登录。', 401, 'AUTHENTICATION_REQUIRED');
  }
  const roles = headerList(req.headers['x-authenticated-roles']);
  const permissions = new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] || []));
  const projectIds = new Set(headerList(req.headers['x-authenticated-projects']));
  return {
    mode,
    authenticated: true,
    userId,
    displayName: String(req.headers['x-authenticated-name'] || userId).trim().slice(0, 160),
    roles,
    permissions,
    projectIds
  };
}

export function authorizeRequest(req, permission, options = {}) {
  const identity = authenticateRequest(req, options);
  if (identity.mode === 'disabled') return identity;
  if (!identity.permissions.has('*') && !identity.permissions.has(permission)) {
    throw authError('当前账号没有执行此GIS操作的权限。', 403, 'GIS_PERMISSION_DENIED');
  }
  const projectId = String(options.projectId || '');
  if (
    projectId
    && !identity.permissions.has('*')
    && !identity.projectIds.has('*')
    && !identity.projectIds.has(projectId)
  ) {
    throw authError('当前账号不能访问该项目。', 403, 'GIS_PROJECT_ACCESS_DENIED');
  }
  return identity;
}

export function accountableActor(identity, submittedActor) {
  return identity?.authenticated
    ? identity.displayName || identity.userId
    : String(submittedActor || '').trim();
}

export function rbacCapability(env = process.env) {
  const mode = authenticationMode(env);
  return {
    mode,
    enforced: mode === 'required',
    identityHeaders: mode === 'required'
      ? ['x-authenticated-user', 'x-authenticated-roles', 'x-authenticated-projects']
      : [],
    roles: Object.keys(ROLE_PERMISSIONS)
  };
}

export { ROLE_PERMISSIONS };
