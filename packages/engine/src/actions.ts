export type Action =
  | { type: 'playUnit'; cardInstanceId: string; targetInstanceId?: string }
  | { type: 'playModule'; cardInstanceId: string; hostInstanceId: string; targetInstanceId?: string }
  | { type: 'playOrder'; cardInstanceId: string; targetInstanceId?: string }
  | { type: 'useCaptainAbility'; targetInstanceId?: string }
  | { type: 'attack'; attackerInstanceId: string; targetInstanceId: string | 'captain' }
  | { type: 'endTurn' };
