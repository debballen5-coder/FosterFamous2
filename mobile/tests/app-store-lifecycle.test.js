import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { currentFosterPeriod } from '../src/lib/foster-lifecycle';

const storage = new Map();

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => {
      storage.set(key, value);
    },
    removeItem: async (key) => {
      storage.delete(key);
    },
  },
}));

// These storage operations are outside the lifecycle boundary under test.
mock.module('../src/lib/media-storage', () => ({
  createDurableMediaCopies: async () => [],
  deleteRemoteMediaCopies: async () => undefined,
  deleteStoredMediaFiles: async () => undefined,
  isBrokenMediaUri: async () => false,
  mediaUri: (media) => media.remoteUri ?? media.localUri ?? null,
  storePickedMedia: async () => [],
}));

const { migratePersistedState, useAppStore } = await import('../src/lib/state/app-store');

function foster(id, adoptionStatus = 'Available') {
  return {
    id,
    isDemo: false,
    name: id === 'valor' ? 'Valor' : 'Milo',
    species: 'dog',
    sex: 'Male',
    age: '3 years',
    breed: 'Mixed breed',
    weight: '',
    size: 'Medium',
    fosterStartDate: '2026-09-01',
    daysInFoster: 0,
    photoUri: null,
    personality: [],
    personalityNotes: '',
    goodWithDogs: 'Unknown',
    goodWithCats: 'Unknown',
    goodWithChildren: 'Unknown',
    childrenNotes: '',
    houseTrained: 'Unknown',
    crateTrained: 'Unknown',
    energyLevel: null,
    special: { progressMade: '' },
    rescueName: '',
    city: '',
    state: '',
    adoptionUrl: '',
    contactMethod: '',
    adoptionFee: '',
    adoptionStatus,
    considerations: [],
    currentStatus: 'Recovering',
    progressUpdates: [],
    score: {
      overall: 0,
      profileComplete: 0,
      photoLibrary: 0,
      videoLibrary: 0,
      adoptionBio: 0,
      postingConsistency: 0,
    },
  };
}

const valorRecommendation = {
  id: 'valor-boost',
  petId: 'valor',
  category: 'test',
  priority: 'high',
  title: 'Boost Valor',
  explanation: '',
  suggestedAction: '',
  destination: 'create',
  destinationParams: {},
  sourceReason: [],
  generatedAt: '2026-09-08T12:00:00.000Z',
  dateKey: '2026-09-08',
};

beforeEach(() => {
  storage.clear();
  useAppStore.setState({
    fosters: [foster('valor'), foster('milo')],
    activeFosterId: 'valor',
    adoptionBoostRecommendations: [valorRecommendation],
    mediaItems: [{ id: 'valor-photo', fosterId: 'valor', type: 'photo' }],
    contentPosts: [{ id: 'valor-draft', petId: 'valor', status: 'Draft' }],
    publicationRecords: [{ id: 'valor-publication', petId: 'valor' }],
    adoptionBoostCampaigns: [
      {
        id: 'valor-campaign',
        petId: 'valor',
        startedAt: '2026-09-01T12:00:00.000Z',
        completedAt: null,
        status: 'Active',
        currentDay: 8,
        createdAt: '2026-09-01T12:00:00.000Z',
        updatedAt: '2026-09-08T12:00:00.000Z',
      },
    ],
  });
});

describe('authoritative adoption lifecycle store path', () => {
  test('adopts Valor through Add Update, preserves the profile, and selects another active foster', () => {
    const saved = useAppStore.getState().saveFosterProgressUpdate('valor', {
      category: 'General Update',
      summary: 'Valor was adopted today.',
      currentStatus: 'Recovering',
      adoptionStatus: 'Adopted',
      adoptionDate: 'Sept 8, 2026',
    });

    const state = useAppStore.getState();
    const valor = state.fosters.find((candidate) => candidate.id === 'valor');

    expect(saved).toBe(true);
    expect(valor.adoptionStatus).toBe('Adopted');
    expect(currentFosterPeriod(valor)).toMatchObject({
      startedAt: '2026-09-01',
      endedAt: '2026-09-08',
      status: 'Adopted',
    });
    expect(valor.adoptionEvents).toEqual([
      expect.objectContaining({ adoptedAt: '2026-09-08' }),
    ]);
    expect(valor.progressUpdates).toEqual([
      expect.objectContaining({ category: 'Adoption Status', summary: 'Valor was adopted today.' }),
    ]);
    expect(state.activeFosterId).toBe('milo');
    expect(state.adoptionBoostRecommendations).toEqual([]);
    expect(state.adoptionBoostCampaigns[0]).toMatchObject({ status: 'Completed' });
    expect(state.mediaItems).toEqual([{ id: 'valor-photo', fosterId: 'valor', type: 'photo' }]);
    expect(state.contentPosts).toEqual([{ id: 'valor-draft', petId: 'valor', status: 'Draft' }]);
    expect(state.publicationRecords).toEqual([{ id: 'valor-publication', petId: 'valor' }]);

    const rehydrated = migratePersistedState({
      fosters: state.fosters,
      activeFosterId: state.activeFosterId,
    });
    const restoredValor = rehydrated.fosters.find((candidate) => candidate.id === 'valor');
    expect(restoredValor.adoptionStatus).toBe('Adopted');
    expect(currentFosterPeriod(restoredValor).endedAt).toBe('2026-09-08');
    expect(rehydrated.activeFosterId).toBe('milo');
  });

  test('uses the no-active-foster selection when adoption completes the last active profile', () => {
    useAppStore.setState({ fosters: [foster('valor')], activeFosterId: 'valor' });

    const saved = useAppStore.getState().saveFosterProgressUpdate('valor', {
      category: 'General Update',
      summary: '',
      currentStatus: 'Recovering',
      adoptionStatus: 'Adopted',
      adoptionDate: '2026-09-08',
    });

    expect(saved).toBe(true);
    expect(useAppStore.getState().activeFosterId).toBeNull();
    expect(useAppStore.getState().fosters[0].adoptionStatus).toBe('Adopted');
  });

  test('allows a backdated adoption and aligns its foster period without losing history', () => {
    const save = useAppStore.getState().saveFosterProgressUpdate;

    for (const adoptionDate of ['not a date', '2099-01-01']) {
      expect(save('valor', {
        category: 'General Update',
        summary: '',
        currentStatus: 'Recovering',
        adoptionStatus: 'Adopted',
        adoptionDate,
      })).toBe(false);
    }

    expect(save('valor', {
      category: 'General Update',
      summary: 'Valor was adopted before this profile was added.',
      currentStatus: 'Recovering',
      adoptionStatus: 'Adopted',
      adoptionDate: '2026-08-31',
    })).toBe(true);

    const valor = useAppStore.getState().fosters.find((candidate) => candidate.id === 'valor');
    expect(valor.adoptionStatus).toBe('Adopted');
    expect(valor.fosterStartDate).toBe('2026-08-31');
    expect(currentFosterPeriod(valor)).toMatchObject({
      startedAt: '2026-08-31',
      endedAt: '2026-08-31',
      status: 'Adopted',
    });
    expect(valor.adoptionEvents).toEqual([
      expect.objectContaining({ adoptedAt: '2026-08-31' }),
    ]);
  });

  test('does not allow generic profile edits to create a fake adopted state', () => {
    useAppStore.getState().updateFoster('valor', { adoptionStatus: 'Adopted' });

    const valor = useAppStore.getState().fosters.find((candidate) => candidate.id === 'valor');
    expect(valor.adoptionStatus).toBe('Available');
    expect(currentFosterPeriod(valor)).toMatchObject({ status: 'Active', endedAt: null });
  });

  test('reactivates and readopts without overwriting the prior adoption history', () => {
    const save = useAppStore.getState().saveFosterProgressUpdate;
    expect(save('valor', {
      category: 'General Update',
      summary: '',
      currentStatus: 'Recovering',
      adoptionStatus: 'Adopted',
      adoptionDate: '2026-09-08',
    })).toBe(true);

    expect(useAppStore.getState().reactivateFoster('valor', '2026-09-12')).toBe(true);
    expect(save('valor', {
      category: 'General Update',
      summary: '',
      currentStatus: 'Available again',
      adoptionStatus: 'Adopted',
      adoptionDate: '2026-09-15',
    })).toBe(true);

    const valor = useAppStore.getState().fosters.find((candidate) => candidate.id === 'valor');
    expect(valor.adoptionStatus).toBe('Adopted');
    expect(valor.adoptionEvents).toHaveLength(2);
    expect(valor.fosterPeriods).toEqual([
      expect.objectContaining({ startedAt: '2026-09-01', endedAt: '2026-09-08', status: 'Adopted' }),
      expect.objectContaining({ startedAt: '2026-09-12', endedAt: '2026-09-15', status: 'Adopted' }),
    ]);
  });
});
