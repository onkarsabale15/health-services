'use client';

import { motion } from 'framer-motion';
import PatientBanner from '@/components/PatientBanner';
import { Skeleton } from '@/components/Skeleton';
import { useAppointment } from '@/hooks/useResource';
import { usePatientBannerData } from '@/hooks/usePatientBannerData';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import type { AppointmentSummary, EncounterSummary } from '@/types';

/**
 * Visit (encounter) summary tab.
 *
 * Dedicated to the current encounter context — formerly an inline
 * "Current Visit" block on the Clinical Summary, lifted out so the
 * encounter detail can stretch out and the Clinical Summary can stay
 * focused on the active-data 2x2 grid.
 *
 * Data flow: patient → encounter (by id from patient meta) → appointment
 * (by id from encounter response). Same chain as Clinical Summary; the
 * BE responses are bridge-cached so re-fetching across tab navigation
 * is a 304 / cache hit, not a real round-trip.
 */
export default function VisitPage() {
  const { patient, encounter, bannerData } = usePatientBannerData();
  const appointment = useAppointment(encounter.data?.appointmentId);
  const banner = bannerData ? <PatientBanner data={bannerData} /> : null;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
      {banner}

      {/* Encounter detail */}
      {encounter.loading && !encounter.data ? (
        <EncounterSkeleton />
      ) : encounter.data ? (
        <EncounterDetailCard encounter={encounter.data} />
      ) : patient.data ? (
        <NoEncounterEmptyState />
      ) : null}

      {/* Linked appointment */}
      {appointment.loading && !appointment.data ? (
        <AppointmentSkeleton />
      ) : appointment.data ? (
        <AppointmentDetailCard appointment={appointment.data} />
      ) : null}
    </motion.div>
  );
}

// ─── Encounter ───────────────────────────────────────────────────────────

function EncounterDetailCard({ encounter }: { encounter: EncounterSummary }) {
  return (
    <motion.div variants={fadeInUp} className="cds-card p-5 space-y-4">
      <div className="cds-section-header">
        <span className="material-symbols-outlined icon">medical_information</span>
        <h3>Current Encounter</h3>
        <span className={`badge badge-${encounter.status === 'in-progress' ? 'active' : encounter.status} ml-auto`}>
          {encounter.status}
        </span>
      </div>

      <Field label="Type" value={encounter.type} prominent />
      {encounter.reasonForVisit && <Field label="Reason for visit" value={encounter.reasonForVisit} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {encounter.startDate && <Field label="Started" value={formatDateTime(encounter.startDate)} />}
        {encounter.endDate && <Field label="Ended" value={formatDateTime(encounter.endDate)} />}
        {encounter.department && <Field label="Department / location" value={encounter.department} />}
        {encounter.provider && <Field label="Provider" value={encounter.provider} />}
      </div>

      <div className="text-[10px] text-secondary/60 font-mono pt-2 border-t border-surface-container-high/30">
        Encounter ID: {encounter.id}
      </div>
    </motion.div>
  );
}

function EncounterSkeleton() {
  return (
    <motion.div variants={fadeInUp} className="cds-card p-5 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </motion.div>
  );
}

function NoEncounterEmptyState() {
  return (
    <motion.div variants={fadeInUp} className="cds-card p-8 text-center space-y-2">
      <span className="material-symbols-outlined text-secondary/40" style={{ fontSize: 40 }}>
        event_busy
      </span>
      <p className="text-sm text-surface-on font-medium">No active encounter</p>
      <p className="text-xs text-secondary max-w-md mx-auto">
        This session has no encounter context. Re-launch from the EHR with an encounter selected, or pick one via the
        context picker.
      </p>
    </motion.div>
  );
}

// ─── Appointment ─────────────────────────────────────────────────────────

function AppointmentDetailCard({ appointment }: { appointment: AppointmentSummary }) {
  return (
    <motion.div variants={fadeInUp} className="cds-card p-5 space-y-4">
      <div className="cds-section-header">
        <span className="material-symbols-outlined icon">calendar_month</span>
        <h3>Linked Appointment</h3>
        <span className={`badge badge-${appointmentBadge(appointment.status)} ml-auto`}>{appointment.status}</span>
      </div>

      <Field label="Type" value={appointment.type} prominent />
      {appointment.reasonForVisit && <Field label="Reason for visit" value={appointment.reasonForVisit} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {appointment.startDate && <Field label="Scheduled start" value={formatDateTime(appointment.startDate)} />}
        {appointment.endDate && <Field label="Scheduled end" value={formatDateTime(appointment.endDate)} />}
        {appointment.location && <Field label="Location" value={appointment.location} />}
        {appointment.provider && <Field label="Provider" value={appointment.provider} />}
      </div>

      <div className="text-[10px] text-secondary/60 font-mono pt-2 border-t border-surface-container-high/30">
        Appointment ID: {appointment.id}
      </div>
    </motion.div>
  );
}

function AppointmentSkeleton() {
  return (
    <motion.div variants={fadeInUp} className="cds-card p-5 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </motion.div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────

function Field({ label, value, prominent }: { label: string; value: string; prominent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-secondary/70 mb-0.5">{label}</p>
      <p className={prominent ? 'text-base font-semibold text-surface-on' : 'text-sm text-surface-on'}>{value}</p>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function appointmentBadge(status: string): string {
  switch (status) {
    case 'booked':
      return 'info';
    case 'arrived':
    case 'fulfilled':
      return 'active';
    case 'cancelled':
    case 'noshow':
      return 'severe';
    default:
      return 'completed';
  }
}
