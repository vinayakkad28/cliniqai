import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// In-memory audit log store (in production, this would query Cloud Logging or a dedicated audit table)
interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'EXPORT';
  resource: string;
  resourceId: string;
  details: string;
  ip: string;
  userAgent: string;
}

const auditStore: AuditEntry[] = [];
let auditIdCounter = 1;

// Record an audit event (called internally by other routes)
export function recordAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
  auditStore.unshift({
    ...entry,
    id: `audit_${(auditIdCounter++).toString().padStart(6, '0')}`,
    timestamp: new Date().toISOString(),
  });
  // Keep last 10000 entries in memory
  if (auditStore.length > 10000) auditStore.pop();
}

// GET /audit-log - List audit log entries with filters
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      action,
      resource,
      userId,
      search,
      from,
      to,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    let filtered = [...auditStore];

    if (action) filtered = filtered.filter((e) => e.action === action);
    if (resource) filtered = filtered.filter((e) => e.resource === resource);
    if (userId) filtered = filtered.filter((e) => e.userId === userId);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.details.toLowerCase().includes(q) ||
          e.userName.toLowerCase().includes(q) ||
          e.resourceId.toLowerCase().includes(q)
      );
    }
    if (from) filtered = filtered.filter((e) => e.timestamp >= from);
    if (to) filtered = filtered.filter((e) => e.timestamp <= to);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const total = filtered.length;
    const data = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Audit log list error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

// GET /audit-log/export - Export audit log as CSV
router.get('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { from, to, action, resource } = req.query as Record<string, string>;

    let filtered = [...auditStore];
    if (action) filtered = filtered.filter((e) => e.action === action);
    if (resource) filtered = filtered.filter((e) => e.resource === resource);
    if (from) filtered = filtered.filter((e) => e.timestamp >= from);
    if (to) filtered = filtered.filter((e) => e.timestamp <= to);

    const csv = [
      'Timestamp,User,Action,Resource,Resource ID,Details,IP',
      ...filtered.map(
        (e) =>
          `"${e.timestamp}","${e.userName}","${e.action}","${e.resource}","${e.resourceId}","${e.details.replace(/"/g, '""')}","${e.ip}"`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error('Audit log export error:', error);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

// GET /audit-log/stats - Summary statistics
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEntries = auditStore.filter((e) => e.timestamp >= today);

    const actionCounts: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    todayEntries.forEach((e) => {
      actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
      resourceCounts[e.resource] = (resourceCounts[e.resource] || 0) + 1;
      userCounts[e.userName] = (userCounts[e.userName] || 0) + 1;
    });

    res.json({
      today: todayEntries.length,
      total: auditStore.length,
      byAction: actionCounts,
      byResource: resourceCounts,
      topUsers: Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    });
  } catch (error: any) {
    console.error('Audit stats error:', error);
    res.status(500).json({ error: 'Failed to get audit stats' });
  }
});

export default router;
