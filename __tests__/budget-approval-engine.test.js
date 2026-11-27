import {
  calculateThreeLayerBudget,
  validateHardStopBudget,
  resolveApprovalMatrix,
  canRoleApproveStep,
  evaluateTieredApprovalStep,
} from '@/lib/utils/budget-control';

describe('Wave B: 3-Layer Budget Control, Hard-Stop & Dynamic Approval Matrix', () => {
  test('calculateThreeLayerBudget menghitung Available = Pagu - (Committed [PO+SPK+Pending] + Actual)', () => {
    const res = calculateThreeLayerBudget({
      paguRab: 1_000_000_000,
      committedPo: 200_000_000,
      committedSpk: 150_000_000,
      committedPendingCash: 50_000_000,
      actualCost: 300_000_000,
    });

    expect(res.committedBudget).toBe(400_000_000);
    expect(res.totalUsed).toBe(700_000_000);
    expect(res.availableBudget).toBe(300_000_000);
    expect(res.utilizationPct).toBe(70);
    expect(res.status).toBe('SAFE');
  });

  test('validateHardStopBudget memblokir pengajuan yang melebihi Available Budget', () => {
    const blocked = validateHardStopBudget(120_000_000, 150_000_000, {
      enforceHardStop: true,
      paguRab: 500_000_000,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.shortfall).toBe(30_000_000);
    expect(blocked.message).toMatch(/Hard-Stop/i);

    const allowed = validateHardStopBudget(120_000_000, 120_000_000, {
      enforceHardStop: true,
      paguRab: 500_000_000,
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.remainingAfter).toBe(0);
  });

  test('resolveApprovalMatrix memilih tier nominal, kategori spesifik, dan override proyek secara dinamis', () => {
    const rules = [
      {
        id: 'g1',
        project_id: null,
        rule_name: 'Tier 1 < 5 Jt',
        document_type: 'CASH_OUT',
        cost_category: 'ALL',
        min_amount: 0,
        max_amount: 4_999_999.99,
        approver_roles: ['Project Manager'],
        require_mfa: false,
        is_active: true,
        priority: 10,
      },
      {
        id: 'g2',
        project_id: null,
        rule_name: 'Tier 2 5-50 Jt',
        document_type: 'CASH_OUT',
        cost_category: 'ALL',
        min_amount: 5_000_000,
        max_amount: 50_000_000,
        approver_roles: ['Project Manager', 'Finance Manager'],
        require_mfa: true,
        is_active: true,
        priority: 20,
      },
      {
        id: 'g3',
        project_id: null,
        rule_name: 'Tier 3 > 50 Jt',
        document_type: 'CASH_OUT',
        cost_category: 'ALL',
        min_amount: 50_000_000.01,
        max_amount: null,
        approver_roles: ['Project Manager', 'Finance Manager', 'Owner'],
        require_mfa: true,
        is_active: true,
        priority: 30,
      },
      {
        id: 'p-override',
        project_id: 'proj-saddang',
        rule_name: 'Override Material Saddang',
        document_type: 'CASH_OUT',
        cost_category: 'Material',
        min_amount: 5_000_000,
        max_amount: 50_000_000,
        approver_roles: ['Project Manager', 'Central Procurement', 'Finance Manager'],
        require_mfa: true,
        is_active: true,
        priority: 5,
      },
    ];

    const t1 = resolveApprovalMatrix(rules, { documentType: 'CASH_OUT', costCategory: 'Upah', amount: 3_500_000 });
    expect(t1.approverRoles).toEqual(['Project Manager']);

    const t2 = resolveApprovalMatrix(rules, { documentType: 'CASH_OUT', costCategory: 'Upah', amount: 25_000_000 });
    expect(t2.approverRoles).toEqual(['Project Manager', 'Finance Manager']);

    const t3 = resolveApprovalMatrix(rules, { documentType: 'CASH_OUT', costCategory: 'Subkon', amount: 120_000_000 });
    expect(t3.approverRoles).toEqual(['Project Manager', 'Finance Manager', 'Owner']);

    const projOverride = resolveApprovalMatrix(rules, {
      documentType: 'CASH_OUT',
      costCategory: 'Material',
      amount: 15_000_000,
      projectId: 'proj-saddang',
    });
    expect(projOverride.approverRoles).toEqual(['Project Manager', 'Central Procurement', 'Finance Manager']);
  });

  test('evaluateTieredApprovalStep dan canRoleApproveStep memproses jenjang persetujuan multi-tahap dengan benar', () => {
    const chain = ['Project Manager', 'Finance Manager', 'Owner'];

    expect(canRoleApproveStep('Project Manager', { projectRole: 'Project Manager' })).toBe(true);
    expect(canRoleApproveStep('Finance Manager', { projectRole: 'Project Manager' })).toBe(false);
    expect(canRoleApproveStep('Finance Manager', { globalRole: 'Finance Manager' })).toBe(true);
    expect(canRoleApproveStep('Owner', { globalRole: 'Auditor' })).toBe(false);

    const step1 = evaluateTieredApprovalStep({ chain, currentStep: 1, decision: 'APPROVED' });
    expect(step1).toEqual({
      approvalStatus: 'Pending',
      nextStep: 2,
      totalSteps: 3,
      nextRequiredRole: 'Finance Manager',
      isFinal: false,
    });

    const stepFinal = evaluateTieredApprovalStep({ chain, currentStep: 3, decision: 'APPROVED' });
    expect(stepFinal.approvalStatus).toBe('Approved');
    expect(stepFinal.isFinal).toBe(true);

    const rejected = evaluateTieredApprovalStep({ chain, currentStep: 2, decision: 'REJECTED' });
    expect(rejected.approvalStatus).toBe('Rejected');
    expect(rejected.isFinal).toBe(true);
  });
});
