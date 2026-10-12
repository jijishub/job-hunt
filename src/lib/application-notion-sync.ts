import { after } from 'next/server';
import { getApplicationById, updateApplication } from '@/lib/db';
import { pushApplicationToNotion } from '@/lib/notion';

export function scheduleApplicationNotionSync(id: string) {
  after(async () => {
    try {
      // Read current data so queued work does not start with an outdated draft.
      const app = await getApplicationById(id);
      if (!app || app.status === 'LEAD' || app.sync_status === 'SYNCED') return;
      await pushApplicationToNotion(app);
    } catch (error) {
      console.error('Background application Notion sync failed:', error);
      try { await updateApplication(id, { sync_status: 'ERROR' }); }
      catch (saveError) { console.error('Failed to record Notion sync error:', saveError); }
    }
  });
}
