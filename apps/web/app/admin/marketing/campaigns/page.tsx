import 'server-only';
import { redirect } from 'next/navigation';

// Marketing is one page: this was the same hub client with a preset tab.
// Kept as a redirect so existing links/bookmarks keep working.
export default function Page() {
  redirect('/admin/marketing?tab=campaigns');
}
