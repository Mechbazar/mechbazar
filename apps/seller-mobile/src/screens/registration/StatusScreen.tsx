import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { colors, Typography, Card, Button } from '@mechbazar/shared';
import { Clock, AlertTriangle, Ban } from 'lucide-react-native';
import { logout } from '../../store';

const STATUS_META: Record<string, { title: string; description: string; icon: React.ComponentType<any>; editable: boolean }> = {
  UNDER_VERIFICATION: {
    title: 'Application under review',
    description: "We're reviewing your business documents. This usually takes 1-2 business days.",
    icon: Clock,
    editable: false,
  },
  REJECTED: {
    title: 'Application rejected',
    description: 'Your seller application was not approved. Fix the issue and resubmit, or contact support for details.',
    icon: AlertTriangle,
    editable: true,
  },
  SUSPENDED: {
    title: 'Account suspended',
    description: 'Your seller account has been suspended. Contact support for details.',
    icon: Ban,
    editable: false,
  },
  BLOCKED: {
    title: 'Account blocked',
    description: 'Your seller account has been blocked. Contact support for details.',
    icon: Ban,
    editable: false,
  },
  INACTIVE: {
    title: 'Account inactive',
    description: 'Your seller account is currently inactive. Contact support to reactivate it.',
    icon: Ban,
    editable: false,
  },
};

export const StatusScreen = ({ status, onEdit }: { status: string; onEdit: () => void }) => {
  const dispatch = useDispatch();
  const meta = STATUS_META[status] || STATUS_META.UNDER_VERIFICATION;
  const Icon = meta.icon;

  return (
    <View style={styles.container}>
      <Card style={{ alignItems: 'center', padding: 32 }}>
        <Icon color={colors.primary} size={40} />
        <Typography variant="h2" style={{ marginTop: 16, textAlign: 'center' }}>{meta.title}</Typography>
        <Typography variant="body" style={{ marginTop: 8, textAlign: 'center', color: colors.textSecondary }}>
          {meta.description}
        </Typography>

        {meta.editable && (
          <Button title="Edit & Resubmit" onPress={onEdit} style={{ marginTop: 24, alignSelf: 'stretch' }} />
        )}
        <Button title="Log Out" variant="outline" onPress={() => dispatch(logout())} style={{ marginTop: 12, alignSelf: 'stretch' }} />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24 },
});
