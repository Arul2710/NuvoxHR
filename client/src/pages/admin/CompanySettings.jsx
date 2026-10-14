import { useState, useEffect } from 'react';
import { Save, Building2 } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

export default function CompanySettings() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useApi(async () => {
    const { data } = await api.get('/company/details');
    return data.data;
  }, []);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.put('/company/details', form);
      toast.success('Company details saved');
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <FullScreenLoader label="Loading company details…" />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader title="Company Details" description="Configure company information used across documents and reports.">
        <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save</Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><Building2 className="h-5 w-5 text-brand-600" /> Basic Information</h3>
          <div className="space-y-4">
            <Input label="Company Name" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
            <Input label="Legal Name" value={form.legalName || ''} onChange={(e) => set('legalName', e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Phone" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
              <Input label="Email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <Input label="Website" value={form.website || ''} onChange={(e) => set('website', e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="GSTIN" value={form.gstin || ''} onChange={(e) => set('gstin', e.target.value)} />
              <Input label="CIN" value={form.cin || ''} onChange={(e) => set('cin', e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Address</h3>
          <div className="space-y-4">
            <Input label="Address Line 1" value={form.addressLine1 || ''} onChange={(e) => set('addressLine1', e.target.value)} />
            <Input label="Address Line 2" value={form.addressLine2 || ''} onChange={(e) => set('addressLine2', e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="City" value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
              <Input label="State" value={form.state || ''} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Pincode" value={form.pincode || ''} onChange={(e) => set('pincode', e.target.value)} />
              <Input label="Country" value={form.country || ''} onChange={(e) => set('country', e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Signatory</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Signatory Name" value={form.signatoryName || ''} onChange={(e) => set('signatoryName', e.target.value)} />
            <Input label="Signatory Designation" value={form.signatoryDesignation || ''} onChange={(e) => set('signatoryDesignation', e.target.value)} />
          </div>
        </Card>
      </div>
    </div>
  );
}
