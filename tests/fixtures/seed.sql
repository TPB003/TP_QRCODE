DELETE FROM rate_limits;

INSERT OR IGNORE INTO users (id, email, created_at, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111', 'demo@tpqr.local', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO projects (
  id, owner_id, name, kind, status, revision, draft_content_json, visual_style_json,
  published_version_id, created_at, updated_at, deleted_at
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '设备巡检二维码',
  'business',
  'active',
  0,
  '{"type":"business","templateKey":"inspection","schema":{"title":"设备巡检记录","description":"请按照实际情况填写巡检内容，确保设备运行正常。","coverAssetId":null,"fields":[{"id":"33333333-3333-4333-8333-333333333333","type":"shortText","label":"设备名称","required":true},{"id":"44444444-4444-4444-8444-444444444444","type":"shortText","label":"巡检人","required":true},{"id":"55555555-5555-4555-8555-555555555555","type":"date","label":"巡检日期","required":true},{"id":"66666666-6666-4666-8666-666666666666","type":"singleChoice","label":"巡检结果","required":true,"options":["运行正常","发现异常"]},{"id":"77777777-7777-4777-8777-777777777777","type":"longText","label":"异常说明","required":false}]}}',
  '{"foreground":"#2563EB","background":"#FBF9F3","dotStyle":"rounded","cornerSquareStyle":"extra-rounded","cornerDotStyle":"dot","logoAssetId":null,"frameText":""}',
  NULL,
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z',
  NULL
);

INSERT OR IGNORE INTO entity_codes (id, project_id, code_id, name, external_id, fields_json, slug, created_at)
VALUES (
  '88888888-8888-4888-8888-888888888888',
  '22222222-2222-4222-8222-222222222222',
  '99999999-9999-4999-8999-999999999999',
  '空压机 1 号',
  'EQ-001',
  '{"位置":"生产车间 A 区"}',
  'TPQRDEMO01',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO project_versions (id, project_id, version, snapshot_json, published_at)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  1,
  '{"id":"22222222-2222-4222-8222-222222222222","ownerId":"11111111-1111-4111-8111-111111111111","name":"设备巡检二维码","kind":"business","status":"active","revision":0,"content":{"type":"business","templateKey":"inspection","schema":{"title":"设备巡检记录","description":"请按照实际情况填写巡检内容，确保设备运行正常。","coverAssetId":null,"fields":[{"id":"33333333-3333-4333-8333-333333333333","type":"shortText","label":"设备名称","required":true},{"id":"44444444-4444-4444-8444-444444444444","type":"shortText","label":"巡检人","required":true},{"id":"55555555-5555-4555-8555-555555555555","type":"date","label":"巡检日期","required":true},{"id":"66666666-6666-4666-8666-666666666666","type":"singleChoice","label":"巡检结果","required":true,"options":["运行正常","发现异常"]},{"id":"77777777-7777-4777-8777-777777777777","type":"longText","label":"异常说明","required":false}]}},"visualStyle":{"foreground":"#2563EB","background":"#FBF9F3","dotStyle":"rounded","cornerSquareStyle":"extra-rounded","cornerDotStyle":"dot","logoAssetId":null,"frameText":""},"publishedVersionId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
  '2026-01-01T00:00:00.000Z'
);

UPDATE projects
SET published_version_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
WHERE id = '22222222-2222-4222-8222-222222222222' AND published_version_id IS NULL;
