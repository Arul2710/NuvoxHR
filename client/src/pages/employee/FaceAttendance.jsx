import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, CalendarCheck2, ScanFace, ShieldAlert } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { usePolling } from '../../hooks/useDebounce';
import { formatTime, formatDuration } from '../../services/format';
import { fetchAttendanceSettings, resolveGeoGate } from '../../services/attendanceSettings';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import FaceCapture from '../../components/FaceCapture';

export default function FaceAttendance() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('checkin');
  const [record, setRecord] = useState(null);
  const [dupHint, setDupHint] = useState(null);
  const [forceStart, setForceStart] = useState(0);
  const [settings, setSettings] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [gating, setGating] = useState(false);
  const [gateError, setGateError] = useState(null);
  const [capturedLocation, setCapturedLocation] = useState(null);
  const [selfBusy, setSelfBusy] = useState(false);
  const [selfNotice, setSelfNotice] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await fetchAttendanceSettings());
    } catch (_e) {
      // keep the last known settings if the fetch fails
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const today = usePolling(async () => {
    const { data } = await api.get('/attendance/today');
    return data.data.rows?.[0]?.record || null;
  }, { interval: 30000 });

  const rec = today.data || record;

  const switchMode = (next) => {
    setMode(next);
    setDupHint(null);
    setGateError(null);
    setSelfNotice(null);
    setCapturedLocation(null);
    setForceStart((n) => n + 1);
  };

  // Used when the administrator has disabled face attendance: record the
  // attendance through the configured alternative (self-service) method. The
  // geofence is still enforced server-side when geo verification is enabled.
  const doSelfService = async () => {
    setGateError(null);
    setSelfNotice(null);
    setSelfBusy(true);
    try {
      const s = settings || (await fetchAttendanceSettings());
      let location = null;
      if (s.geoEnabled !== false) {
        const geo = await resolveGeoGate(s);
        if (!geo.ok) {
          setGateError(geo);
          return;
        }
        location = geo.location;
      }
      const fd = new FormData();
      if (location) fd.append('location', JSON.stringify({ latitude: location.latitude, longitude: location.longitude }));
      const endpoint = mode === 'checkin' ? 'check-in' : 'check-out';
      const { data } = await api.post(`/attendance/${endpoint}`, fd);
      setRecord(data.data || null);
      setSelfNotice(data.message || 'Attendance recorded.');
      if (today.refetch) await today.refetch();
    } catch (err) {
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message || extractError(err, 'Could not record your attendance. Please try again.');
      setGateError({ code, message });
    } finally {
      setSelfBusy(false);
    }
  };

  const submit = async ({ blob, descriptor }) => {
    const fd = new FormData();
    fd.append('image', blob, 'face.jpg');
    fd.append('descriptor', JSON.stringify(Array.from(descriptor)));
    if (capturedLocation) fd.append('location', JSON.stringify({ latitude: capturedLocation.latitude, longitude: capturedLocation.longitude }));
    try {
      const endpoint = mode === 'checkin' ? 'check-in' : 'check-out';
      const { data } = await api.post(`/attendance/${endpoint}`, fd);
      setRecord(data.data || null);
      return { ok: true, message: data.message, data: data.data, summary: data.summary };
    } catch (err) {
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message || extractError(err, 'Verification failed. Please try again.');
      if (code === 'ALREADY_CHECKED_IN' || code === 'COMPLETED' || code === 'NOT_CHECKED_IN') {
        setDupHint({ code, message, record: err?.response?.data?.data });
      }
      return { ok: false, message, code };
    }
  };

  const handleStart = async () => {
    setGateError(null);
    setGating(true);
    try {
      const s = await fetchAttendanceSettings();
      setSettings(s);

      if (s.faceEnabled === false) {
        setGateError({ code: 'FACE_DISABLED', message: 'Face attendance is currently disabled by your administrator.' });
        return;
      }

      const geo = await resolveGeoGate(s);
      if (!geo.ok) {
        setGateError(geo);
        return;
      }

      setCapturedLocation(geo.location);
      setCameraOpen(true);
    } catch (err) {
      setGateError({ code: 'UNKNOWN', message: extractError(err, 'Could not verify your location. Please try again.') });
    } finally {
      setGating(false);
    }
  };

  const otherMode = mode === 'checkin' ? 'checkout' : 'checkin';
  const otherLabel = mode === 'checkin' ? 'Check Out Instead' : 'Check In Instead';
  const canDo = mode === 'checkin' ? (!rec || !rec.checkInTime) : Boolean(rec?.checkInTime && !rec.checkOutTime);
  const faceDisabled = settings ? settings.faceEnabled === false : null;
  const actionLabel = mode === 'checkin' ? 'Verify My Location & Check In' : 'Verify My Location & Check Out';

  return (
    <div>
      <PageHeader
        title="Face Attendance"
        description={`${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`}
      />

      <Card className="mb-6 max-w-lg">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant={mode === 'checkin' ? 'primary' : 'secondary'}
              onClick={() => switchMode('checkin')}
            >
              <LogIn className="h-4 w-4" /> Check In
            </Button>
            <Button
              variant={mode === 'checkout' ? 'primary' : 'secondary'}
              onClick={() => switchMode('checkout')}
            >
              <LogOut className="h-4 w-4" /> Check Out
            </Button>
          </div>
          {rec?.checkInTime && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              In: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatTime(rec.checkInTime)}</span>
              {rec.checkOutTime && (
                <> · Out: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatTime(rec.checkOutTime)}</span></>
              )}
            </div>
          )}
        </div>
        <div className="border-t px-5 py-3 dark:border-slate-700">
          {rec?.status && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Today's status: <Badge>{rec.status}</Badge>
              {rec.faceVerified && <Badge>Face Verified</Badge>}
              {rec.workingHoursMinutes ? <Badge>Worked {formatDuration(rec.workingHoursMinutes)}</Badge> : null}
            </div>
          )}
          {!rec?.checkInTime && <p className="text-xs text-slate-400">You haven't checked in today yet.</p>}
        </div>
      </Card>

      {faceDisabled === true && !canDo && (
        <div className="card mx-auto max-w-lg">
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <CalendarCheck2 className="h-10 w-10 text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              {mode === 'checkin' ? 'Already checked in today' : 'No active check-in to end'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'checkin' ? 'Self-service check-in is done for today. You can check out instead.' : 'Check in first, then come back to check out.'}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => switchMode(otherMode)}>{otherLabel}</Button>
              <Button variant="ghost" onClick={() => navigate('/employee')}>Back to Dashboard</Button>
            </div>
          </div>
        </div>
      )}

      {faceDisabled === true && canDo && (
        <div className="card mx-auto max-w-lg">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-amber-500" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Face verification is disabled</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Your administrator has turned off face attendance. You can still record attendance using self-service
                attendance{settings?.geoEnabled !== false ? '; your location will be verified against the company geofence.' : '.'}
                {' '}This record will be marked as <span className="font-semibold">Self Service</span>, not face-verified.
              </p>
            </div>

            {selfNotice && (
              <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                {selfNotice}
              </div>
            )}

            {gateError && (
              <div
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  gateError.code === 'OUTSIDE_ALLOWED_AREA'
                    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
                }`}
              >
                {gateError.message}
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <Button onClick={doSelfService} loading={selfBusy} disabled={selfBusy}>
                {mode === 'checkin' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {mode === 'checkin' ? 'Check In (Self Service)' : 'Check Out (Self Service)'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/employee')}>Back to Dashboard</Button>
            </div>
          </div>
        </div>
      )}

      {faceDisabled === false && !canDo && (
        <div className="card mx-auto max-w-lg">
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <CalendarCheck2 className="h-10 w-10 text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              {mode === 'checkin' ? 'Already checked in today' : 'No active check-in to end'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'checkin' ? 'Face check-in is done for today. You can check out instead.' : 'Check in first, then come back to check out.'}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => switchMode(otherMode)}>{otherLabel}</Button>
              <Button variant="ghost" onClick={() => navigate('/employee')}>Back to Dashboard</Button>
            </div>
          </div>
        </div>
      )}

      {faceDisabled === false && canDo && (
        <div className="card mx-auto max-w-lg">
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <ScanFace className="h-10 w-10 text-brand-600 dark:text-brand-400" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                {mode === 'checkin' ? 'Ready to check in?' : 'Ready to check out?'}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Your location is verified against the company geofence first. Only when everything passes does the camera open.
              </p>
            </div>

            {gateError && (
              <div
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  gateError.code === 'OUTSIDE_ALLOWED_AREA'
                    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
                }`}
              >
                {gateError.message}
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              {settings === null && (
                <p className="text-xs text-slate-400">Checking today's attendance rules…</p>
              )}
              <Button onClick={handleStart} loading={gating} disabled={gating || settings === null}>
                <ScanFace className="h-4 w-4" /> {actionLabel}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/employee')}>Back to Dashboard</Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title={mode === 'checkin' ? 'Face Check In' : 'Face Check Out'}
        subtitle="Position your face inside the guide so your identity can be verified."
      >
        {cameraOpen && (
          <FaceCapture
            key={`${mode}-${forceStart}`}
            mode="attendance"
            onCaptured={submit}
            onClose={() => setCameraOpen(false)}
            successExtra={(data) => (
              <div className="mx-auto max-w-sm rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                {mode === 'checkin' ? (
                  <>Checked in at <span className="font-mono font-bold">{formatTime(data?.checkInTime)}</span> · {data?.status === 'Late' ? 'Marked Late' : 'On time'}.</>
                ) : (
                  <>Checked out at <span className="font-mono font-bold">{formatTime(data?.checkOutTime)}</span> · Total <span className="font-bold">{formatDuration(data?.workingHoursMinutes)}</span>.</>
                )}
              </div>
            )}
            failureExtra={({ code }) =>
              dupHint && code === dupHint.code ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                  <p className="font-semibold">{dupHint.message}</p>
                  {dupHint.code === 'ALREADY_CHECKED_IN' && (
                    <div className="mt-2 flex justify-center">
                      <Button size="sm" variant="secondary" onClick={() => switchMode('checkout')}>
                        <LogOut className="h-4 w-4" /> Check Out Instead
                      </Button>
                    </div>
                  )}
                  {dupHint.code === 'NOT_CHECKED_IN' && (
                    <div className="mt-2 flex justify-center">
                      <Button size="sm" variant="secondary" onClick={() => switchMode('checkin')}>
                        <LogIn className="h-4 w-4" /> Check In Instead
                      </Button>
                    </div>
                  )}
                </div>
              ) : null
            }
          />
        )}
      </Modal>
    </div>
  );
}