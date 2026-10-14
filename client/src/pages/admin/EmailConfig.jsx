import { useState, useEffect } from 'react';
import { Save, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

export default function EmailConfig() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useApi(async () => {
    const { data } = await api.get('/emails/config');
    return data.data;
  }, []);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.put('/company/email', { fromName: form.fromName, fromEmail: form.fromEmail, replyTo: form.replyTo });
      toast.success('Email configuration saved');
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <FullScreenLoader label="Loading email config…" />;

  return (
    <div>
      <PageHeader title="Email Configuration" description="Configure email sender settings for document delivery.">
        <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save</Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><Mail className="h-5 w-5 text-brand-600" /> Sender Settings</h3>
          <div className="space-y-4">
            <Input label="From Name" value={form.fromName || ''} onChange={(e) => setForm({ ...form, fromName: e.target.value })} placeholder="e.g. Nuvox HR" />
            <Input label="From Email" type="email" value={form.fromEmail || ''} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="hr@company.com" />
            <Input label="Reply-To" type="email" value={form.replyTo || ''} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} placeholder="Optional" />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">SMTP Status</h3>
          {form.smtpConfigured ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> SMTP is configured and ready to send emails.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">SMTP not configured</p>
                  <p className="mt-1 text-xs">Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables on the server to enable email sending.</p>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <p className="font-medium">Required environment variables:</p>
                <ul className="mt-1 list-inside list-disc">
                  <li>SMTP_HOST — SMTP server hostname</li>
                  <li>SMTP_PORT — SMTP port (default: 587)</li>
                  <li>SMTP_USER — SMTP username</li>
                  <li>SMTP_PASS — SMTP password</li>
                  <li>SMTP_FROM — From address (optional)</li>
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
