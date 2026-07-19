import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { colors, Typography, Card, Button } from '@mechbazar/shared';
import { Clock, AlertTriangle, Ban } from 'lucide-react-native';
import { logout } from '../../store';

const STATUS_META: Record<string, { title: string; description: string; icon: React.ComponentType<any>; editable: boolean }> = {
  PENDING: {
    title: 'Finish your registration',
    description: 'Complete every step and submit your application for review.',
    icon: Clock,
    editable: true,
  },
  UNDER_VERIFICATION: {
    title: 'Application under review',
    description: "We're reviewing your documents. This usually takes 1-2 business days.",
    icon: Clock,
    editable: false,
  },
  RESUBMISSION_REQUIRED: {
    title: 'Changes requested',
    description: 'An admin has asked you to fix and resubmit part of your application.',
    icon: AlertTriangle,
    editable: true,
  },
  REJECTED: {
    title: 'Application rejected',
    description: 'Your application was not approved. Review the remarks below and resubmit if you can address them.',
    icon: AlertTriangle,
    editable: true,
  },
  SUSPENDED: {
    title: 'Account suspended',
    description: 'Your account has been suspended. Contact support for details.',
    icon: Ban,
    editable: false,
  },
  BLOCKED: {
    title: 'Account blocked',
    description: 'Your account has been blocked. Contact support for details.',
    icon: Ban,
    editable: false,
  },
  INACTIVE: {
    title: 'Account inactive',
    description: 'Your account is currently inactive. Contact support to reactivate it.',
    icon: Ban,
    editable: false,
  },
};

export const StatusScreen = ({ status, remarks, onEdit }: { status: string; remarks?: string | null; onEdit: () => void }) => {
  const dispatch = useDispatch();
  const meta = STATUS_META[status] || STATUS_META.PENDING;
  const Icon = meta.icon;

  return (
    <View style={styles.container}>
      <Card style={{ alignItems: 'center', padding: 32 }}>
        <Icon color={colors.primary} size={40} />
        <Typography variant="h2" style={{ marginTop: 16, textAlign: 'center' }}>{meta.title}</Typography>
        <Typography variant="body" style={{ marginTop: 8, textAlign: 'center', color: colors.textSecondary }}>
          {meta.description}
        </Typography>

        {remarks ? (
          <View style={styles.remarksBox}>
            <Typography variant="caption" style={{ fontWeight: '700', color: colors.text }}>Admin remarks</Typography>
            <Typography variant="body" style={{ marginTop: 4 }}>{remarks}</Typography>
          </View>
        ) : null}

        {meta.editable && (
          <Button title="Edit & Continue" onPress={onEdit} style={{ marginTop: 24, alignSelf: 'stretch' }} />
        )}
        <Button title="Log Out" variant="outline" onPress={() => dispatch(logout())} style={{ marginTop: 12, alignSelf: 'stretch' }} />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24 },
  remarksBox: { marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: colors.surfaceHover, alignSelf: 'stretch' },
});
