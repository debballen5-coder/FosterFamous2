import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Cat, Check, Dog, PartyPopper, PawPrint } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import { PawPattern } from '@/components/PawPattern';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel, OptionGroup, TextField } from '@/components/ui/Field';
import { PressableScale } from '@/components/ui/Pressables';
import { StepProgress } from '@/components/ui/Progress';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { cn } from '@/lib/cn';
import { isFutureFosterDate, normalizeFosterDate } from '@/lib/foster-date';
import { currentFosterPeriod } from '@/lib/foster-lifecycle';
import { goBackOrReplace } from '@/lib/navigation';
import { CONSIDERATIONS, PERSONALITY_TRAITS, SPECIAL_PROMPTS } from '@/lib/options';
import { useAppStore } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';
import {
  ADOPTION_STATUSES,
  COMPATIBILITY_OPTIONS,
  ENERGY_LEVELS,
  type AdoptionStatus,
  type Compatibility,
  type EnergyLevel,
  type Foster,
  type PetSize,
  type Sex,
  type Species,
  type SpecialPromptKey,
} from '@/lib/types';

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  'Meet Your Foster',
  'Personality',
  'Home Compatibility',
  'What Makes Them Special?',
  'Adoption Information',
  'Challenges or Considerations',
];

const STEP_BLURBS = [
  'The basics. Only fill in what you actually know.',
  'How would you describe them to a friend?',
  'Honest answers here protect the animal and the adopter.',
  'These little details are what make people fall in love.',
  'Where adopters go next.',
  'Optional. Naming a challenge helps us help you.',
];

/** Everything the wizard collects. Kept local until the final step. */
interface Draft {
  name: string;
  species: Species | null;
  sex: Sex | null;
  age: string;
  breed: string;
  weight: string;
  size: PetSize | null;
  fosterStartDate: string;
  photoUri: string | null;
  personality: string[];
  personalityNotes: string;
  goodWithDogs: Compatibility | null;
  goodWithCats: Compatibility | null;
  goodWithChildren: Compatibility | null;
  childrenNotes: string;
  houseTrained: Compatibility | null;
  crateTrained: Compatibility | null;
  energyLevel: EnergyLevel | null;
  special: Record<SpecialPromptKey, string>;
  rescueName: string;
  rescueContactName: string;
  city: string;
  state: string;
  adoptionUrl: string;
  adoptionEmail: string;
  adoptionPhone: string;
  adoptionInstructions: string;
  contactMethod: string;
  adoptionFee: string;
  adoptionStatus: AdoptionStatus | null;
  considerations: string[];
}

const EMPTY_SPECIAL = SPECIAL_PROMPTS.reduce<Record<string, string>>((acc, p) => {
  acc[p.key] = '';
  return acc;
}, {}) as Record<SpecialPromptKey, string>;

const EMPTY_DRAFT: Draft = {
  name: '',
  species: null,
  sex: null,
  age: '',
  breed: '',
  weight: '',
  size: null,
  fosterStartDate: '',
  photoUri: null,
  personality: [],
  personalityNotes: '',
  goodWithDogs: null,
  goodWithCats: null,
  goodWithChildren: null,
  childrenNotes: '',
  houseTrained: null,
  crateTrained: null,
  energyLevel: null,
  special: EMPTY_SPECIAL,
  rescueName: '',
  rescueContactName: '',
  city: '',
  state: '',
  adoptionUrl: '',
  adoptionEmail: '',
  adoptionPhone: '',
  adoptionInstructions: '',
  contactMethod: '',
  adoptionFee: '',
  adoptionStatus: null,
  considerations: [],
};

function draftFromFoster(foster: Foster): Draft {
  return {
    name: foster.name,
    species: foster.species,
    sex: foster.sex,
    age: foster.age,
    breed: foster.breed,
    weight: foster.weight,
    size: foster.size,
    fosterStartDate: currentFosterPeriod(foster)?.startedAt ?? foster.fosterStartDate ?? '',
    photoUri: foster.photoUri,
    personality: [...foster.personality],
    personalityNotes: foster.personalityNotes,
    goodWithDogs: foster.goodWithDogs,
    goodWithCats: foster.goodWithCats,
    goodWithChildren: foster.goodWithChildren,
    childrenNotes: foster.childrenNotes,
    houseTrained: foster.houseTrained,
    crateTrained: foster.crateTrained,
    energyLevel: foster.energyLevel,
    special: { ...foster.special },
    rescueName: foster.rescueName,
    rescueContactName: foster.rescueContactName ?? '',
    city: foster.city,
    state: foster.state,
    adoptionUrl: foster.adoptionUrl,
    adoptionEmail: foster.adoptionEmail ?? '',
    adoptionPhone: foster.adoptionPhone ?? '',
    adoptionInstructions: foster.adoptionInstructions ?? '',
    contactMethod: foster.contactMethod,
    adoptionFee: foster.adoptionFee,
    adoptionStatus: foster.adoptionStatus,
    considerations: [...foster.considerations],
  };
}

export default function FosterWizardScreen() {
  const router = useRouter();
  const { id, step: requestedStep } = useLocalSearchParams<{ id?: string; step?: string }>();
  const fosters = useAppStore((s) => s.fosters);
  const defaultRescueInformation = useAppStore((s) => s.defaultRescueInformation);
  const saveFosterWithProfileMedia = useAppStore((s) => s.saveFosterWithProfileMedia);
  const updateFoster = useAppStore((s) => s.updateFoster);
  const existingFoster = useMemo(() => fosters.find((foster) => foster.id === id), [fosters, id]);
  const [newFosterId] = useState<string>(() => `foster-${Date.now()}`);
  const [step, setStep] = useState<number>(() => {
    const parsed = Number(requestedStep);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= TOTAL_STEPS ? parsed : 1;
  });
  const [done, setDone] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFosterId, setSavedFosterId] = useState<string | null>(null);
  const [selectedPhotoAsset, setSelectedPhotoAsset] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [draft, setDraft] = useState<Draft>(() =>
    existingFoster
      ? draftFromFoster(existingFoster)
      : {
          ...EMPTY_DRAFT,
          special: { ...EMPTY_SPECIAL },
          rescueName: defaultRescueInformation.rescueName,
          rescueContactName: defaultRescueInformation.contactName,
          adoptionUrl: defaultRescueInformation.adoptionWebsite,
          adoptionEmail: defaultRescueInformation.adoptionEmail,
          adoptionPhone: defaultRescueInformation.phone,
          adoptionInstructions: defaultRescueInformation.instructions,
          contactMethod: defaultRescueInformation.adoptionEmail || defaultRescueInformation.phone
            ? [defaultRescueInformation.adoptionEmail && `Email: ${defaultRescueInformation.adoptionEmail}`, defaultRescueInformation.phone && `Phone: ${defaultRescueInformation.phone}`].filter(Boolean).join(' · ')
            : '',
        },
  );

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const toggleIn = useCallback((key: 'personality' | 'considerations', value: string) => {
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));
  }, []);

  const petName = draft.name.trim() || 'Your foster';

  const saveFosterMutation = useMutation({
    mutationFn: ({
      foster,
      photoAsset,
      preservesExistingPhoto,
    }: {
      foster: Foster;
      photoAsset: ImagePicker.ImagePickerAsset | null;
      preservesExistingPhoto: boolean;
    }) => {
      // Editing profile details must not require an older profile photo to be
      // readable or re-uploadable. Only import media when a new photo was chosen.
      if (preservesExistingPhoto) {
        updateFoster(foster.id, foster);
        return Promise.resolve(foster);
      }
      return saveFosterWithProfileMedia(foster, photoAsset);
    },
    onSuccess: (savedFoster) => {
      setSavedFosterId(savedFoster.id);
      setDone(true);
    },
    onError: () => {
      setSaveError('We could not save this profile change. Please try again.');
    },
  });
  const { isPending: isSaving, mutate: saveFoster } = saveFosterMutation;

  const finish = useCallback(() => {
    if (isSaving) return;
    setSaveError(null);

    if (!existingFoster && draft.adoptionStatus === 'Adopted') {
      setSaveError('Add this profile as active first, then use Current Status to record the confirmed adoption date.');
      return;
    }

    if (
      existingFoster &&
      (existingFoster.adoptionStatus === 'Adopted' || draft.adoptionStatus === 'Adopted') &&
      existingFoster.adoptionStatus !== draft.adoptionStatus
    ) {
      setSaveError('Use Current Status to record an adoption date, or Reactivate Foster to record a return date.');
      return;
    }

    const enteredStartDate = draft.fosterStartDate.trim();
    const fosterStartDate = enteredStartDate ? normalizeFosterDate(enteredStartDate) : null;
    if (enteredStartDate && !fosterStartDate) {
      setSaveError('Enter a real foster start date, such as Sep 1, 2026.');
      return;
    }
    if (fosterStartDate && isFutureFosterDate(fosterStartDate)) {
      setSaveError('The foster start date cannot be in the future.');
      return;
    }

    const foster: Foster = {
      id: existingFoster?.id ?? newFosterId,
      isDemo: false,
      name: draft.name.trim() || 'My Foster',
      species: draft.species ?? 'dog',
      sex: draft.sex ?? 'Unknown',
      age: draft.age,
      breed: draft.breed,
      weight: draft.weight,
      size: draft.size,
      fosterStartDate,
      daysInFoster: existingFoster?.daysInFoster ?? 1,
      photoUri: draft.photoUri,
      personality: draft.personality,
      personalityNotes: draft.personalityNotes,
      goodWithDogs: draft.goodWithDogs ?? 'Unknown',
      goodWithCats: draft.goodWithCats ?? 'Unknown',
      goodWithChildren: draft.goodWithChildren ?? 'Unknown',
      childrenNotes: draft.childrenNotes,
      houseTrained: draft.houseTrained ?? 'Unknown',
      crateTrained: draft.crateTrained ?? 'Unknown',
      energyLevel: draft.energyLevel,
      special: draft.special,
      rescueName: draft.rescueName,
      rescueContactName: draft.rescueContactName,
      city: draft.city,
      state: draft.state,
      adoptionUrl: draft.adoptionUrl,
      adoptionEmail: draft.adoptionEmail,
      adoptionPhone: draft.adoptionPhone,
      adoptionInstructions: draft.adoptionInstructions,
      contactMethod: draft.contactMethod,
      adoptionFee: draft.adoptionFee,
      adoptionStatus: draft.adoptionStatus ?? 'Not Yet Available',
      considerations: draft.considerations,
      currentStatus: existingFoster?.currentStatus ?? '',
      progressUpdates: existingFoster?.progressUpdates ?? [],
      currentInfoUpdatedAt: existingFoster?.currentInfoUpdatedAt,
      score: existingFoster?.score ?? {
        overall: 34,
        profileComplete: 70,
        photoLibrary: 10,
        videoLibrary: 0,
        adoptionBio: 0,
        postingConsistency: 0,
      },
    };

    saveFoster({
      foster,
      photoAsset: selectedPhotoAsset,
      preservesExistingPhoto: Boolean(existingFoster && !selectedPhotoAsset),
    });
  }, [draft, existingFoster, isSaving, newFosterId, saveFoster, selectedPhotoAsset]);

  const canContinue = useMemo(() => {
    // Only step 1 asks for the bare minimum. The rest is optional by design.
    if (step === 1) return draft.name.trim().length > 0 && draft.species !== null;
    return true;
  }, [draft.name, draft.species, step]);

  if (done) {
    return (
      <CompletionScreen
        petName={petName}
        fosterId={savedFosterId}
        wasEditing={Boolean(existingFoster)}
      />
    );
  }

  return (
    <Screen testID="foster-wizard-screen" edges={['top', 'bottom']}>
      <ScreenHeader
        title={existingFoster ? 'Edit Profile' : 'Add a Foster'}
        subtitle={STEP_TITLES[step - 1]}
        onBack={() =>
          step === 1 ? goBackOrReplace(router, '/(tabs)/fosters') : setStep((s) => s - 1)
        }
      />

      <View className="px-5 pb-4">
        <StepProgress step={step} total={TOTAL_STEPS} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View key={step} entering={FadeInRight.duration(320)}>
            <Text className="font-display text-2xl leading-[32px] text-forest">
              {step === 1 ? 'Meet your foster' : STEP_TITLES[step - 1]}
            </Text>
            <Text className="mb-6 mt-1.5 font-sans text-lg leading-[24px] text-ink-soft">
              {STEP_BLURBS[step - 1]}
            </Text>

            {step === 1 ? (
              <StepOne draft={draft} set={set} onPhotoPicked={setSelectedPhotoAsset} />
            ) : step === 2 ? (
              <StepTwo draft={draft} set={set} toggleIn={toggleIn} />
            ) : step === 3 ? (
              <StepThree draft={draft} set={set} />
            ) : step === 4 ? (
              <StepFour draft={draft} setDraft={setDraft} />
            ) : step === 5 ? (
              <StepFive
                draft={draft}
                set={set}
                existingFoster={existingFoster}
                onRecordAdoption={() => {
                  if (!existingFoster) return;
                  router.push({ pathname: '/foster/update', params: { fosterId: existingFoster.id } });
                }}
              />
            ) : (
              <StepSix draft={draft} toggleIn={toggleIn} />
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View className="border-t border-hairline/70 bg-cream px-5 pb-1 pt-4">
        <Button
          testID="wizard-continue"
          label={
            step === TOTAL_STEPS
              ? existingFoster
                ? 'Save Changes'
                : `Finish — Make ${petName} Famous`
              : 'Continue'
          }
          disabled={!canContinue || isSaving}
          loading={step === TOTAL_STEPS && isSaving}
          onPress={() => {
            if (step === TOTAL_STEPS) {
              void finish();
            } else {
              setStep((s) => s + 1);
            }
          }}
        />
        {existingFoster && step < TOTAL_STEPS ? (
          <Button
            testID="wizard-save-changes"
            label="Save Changes Now"
            variant="secondary"
            className="mt-3"
            disabled={!canContinue || isSaving}
            loading={isSaving}
            onPress={() => void finish()}
          />
        ) : null}
        {saveError ? (
          <Text
            testID="wizard-save-error"
            className="mt-2.5 text-center font-sans text-sm text-clay-deep"
          >
            {saveError}
          </Text>
        ) : null}
        {step === 1 && !canContinue ? (
          <Text className="mt-2.5 text-center font-sans text-sm text-ink-muted">
            A name and dog/cat are all we need to start.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Step 1 */

function StepOne({
  draft,
  set,
  onPhotoPicked,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  onPhotoPicked: (asset: ImagePicker.ImagePickerAsset) => void;
}) {
  const [photoError, setPhotoError] = useState<string | null>(null);

  const pickPhoto = async () => {
    setPhotoError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError('Photo access is needed to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      const selectedAsset = result.canceled ? undefined : result.assets[0];
      if (selectedAsset?.uri) {
        onPhotoPicked(selectedAsset);
        set('photoUri', selectedAsset.uri);
      }
    } catch {
      setPhotoError('We could not open your photo library. Please try again.');
    }
  };

  return (
    <View>
      <FieldLabel>Profile photo</FieldLabel>
      <PressableScale
        testID="wizard-photo-picker"
        accessibilityRole="button"
        accessibilityLabel={draft.photoUri ? 'Change profile photo' : 'Add a profile photo'}
        onPress={pickPhoto}
        scaleTo={0.98}
        className="mb-2 h-[180px] overflow-hidden rounded-4xl border-2 border-dashed border-beige-dark bg-white/70"
      >
        {draft.photoUri ? (
          <>
            <Image
              source={{ uri: draft.photoUri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={180}
            />
            <View className="absolute bottom-3 right-3 flex-row items-center rounded-full bg-cream/95 px-3 py-2">
              <Camera size={16} color={colors.forest} strokeWidth={2.3} />
              <Text className="ml-1.5 font-bold text-sm text-forest">Change photo</Text>
            </View>
          </>
        ) : (
          <View className="flex-1 items-center justify-center">
            <View className="mb-2.5 h-12 w-12 items-center justify-center rounded-full bg-forest-soft">
              <Camera size={22} color={colors.forest} strokeWidth={2.2} />
            </View>
            <Text className="font-bold text-lg text-forest">Add a photo</Text>
            <Text className="mt-0.5 font-sans text-sm text-ink-muted">
              A clear face shot works best
            </Text>
          </View>
        )}
      </PressableScale>
      {photoError ? (
        <Text testID="wizard-photo-error" className="mb-4 font-sans text-sm text-clay-deep">
          {photoError}
        </Text>
      ) : (
        <View className="mb-4" />
      )}

      <TextField
        testID="wizard-name"
        label="Name"
        placeholder="Enter your foster’s name"
        value={draft.name}
        onChangeText={(v) => set('name', v)}
      />

      {/* Species — big, obvious pair */}
      <FieldLabel>Dog or cat?</FieldLabel>
      <View className="mb-5 flex-row gap-3">
        {[
          { value: 'dog' as Species, label: 'Dog', Icon: Dog },
          { value: 'cat' as Species, label: 'Cat', Icon: Cat },
        ].map(({ value, label, Icon }) => {
          const selected = draft.species === value;
          return (
            <PressableScale
              key={value}
              testID={`wizard-species-${value}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => set('species', value)}
              scaleTo={0.96}
              style={selected ? softShadow : undefined}
              className={cn(
                'h-[86px] flex-1 items-center justify-center rounded-3xl border-2',
                selected ? 'border-forest bg-forest' : 'border-hairline bg-white',
              )}
            >
              <Icon size={26} color={selected ? colors.cream : colors.forest} strokeWidth={2.1} />
              <Text
                className={cn(
                  'mt-1.5 font-bold text-lg',
                  selected ? 'text-cream' : 'text-ink-soft',
                )}
              >
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <OptionGroup<Sex>
        label="Sex"
        options={['Male', 'Female', 'Unknown']}
        value={draft.sex}
        onChange={(v) => set('sex', v)}
        columns={3}
      />

      <TextField
        testID="wizard-age"
        label="Age or estimated age"
        placeholder="e.g. 3 years"
        value={draft.age}
        onChangeText={(v) => set('age', v)}
      />
      <TextField
        testID="wizard-breed"
        label="Breed / mix"
        placeholder="e.g. Labrador mix"
        value={draft.breed}
        onChangeText={(v) => set('breed', v)}
        hint="A guess is fine — just say it’s a guess in your posts."
      />
      <TextField
        testID="wizard-weight"
        label="Weight"
        placeholder="e.g. 46 lbs"
        value={draft.weight}
        onChangeText={(v) => set('weight', v)}
      />

      <OptionGroup<PetSize>
        label="Size"
        options={['Small', 'Medium', 'Large', 'Extra Large']}
        value={draft.size}
        onChange={(v) => set('size', v)}
      />

      <TextField
        testID="wizard-start-date"
        label="Foster start date"
        placeholder="Sep 1, 2026"
        value={draft.fosterStartDate}
        onChangeText={(v) => set('fosterStartDate', v)}
        hint="Saved as the official date for Days in Foster. Leave blank only if you do not know it yet."
      />
    </View>
  );
}

/* ---------------------------------------------------------------- Step 2 */

function StepTwo({
  draft,
  set,
  toggleIn,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  toggleIn: (key: 'personality' | 'considerations', value: string) => void;
}) {
  return (
    <View>
      <FieldLabel>Pick everything that fits</FieldLabel>
      <View className="mb-6">
        <ChipRow>
          {PERSONALITY_TRAITS.map((trait) => (
            <Chip
              key={trait}
              testID={`trait-${trait}`}
              label={trait}
              showCheck
              selected={draft.personality.includes(trait)}
              onPress={() => toggleIn('personality', trait)}
            />
          ))}
        </ChipRow>
        <Text className="mt-3 font-sans text-sm text-ink-muted">
          {draft.personality.length} selected · only pick what you’ve actually seen
        </Text>
      </View>

      <TextField
        testID="wizard-personality-notes"
        label="Anything else that describes them?"
        placeholder="Leans his whole body against you the second you sit down…"
        value={draft.personalityNotes}
        onChangeText={(v) => set('personalityNotes', v)}
        multiline
      />
    </View>
  );
}

/* ---------------------------------------------------------------- Step 3 */

function StepThree({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <View>
      <View className="mb-6 rounded-3xl border border-clay/25 bg-clay-soft/70 p-4">
        <Text className="font-medium text-base leading-[20px] text-clay-deep">
          If you don’t know, choose Unknown. Foster Famous will never turn an unknown into a “good
          with” claim in your posts.
        </Text>
      </View>

      <OptionGroup<Compatibility>
        label="Good with dogs?"
        options={COMPATIBILITY_OPTIONS}
        value={draft.goodWithDogs}
        onChange={(v) => set('goodWithDogs', v)}
      />
      <OptionGroup<Compatibility>
        label="Good with cats?"
        options={COMPATIBILITY_OPTIONS}
        value={draft.goodWithCats}
        onChange={(v) => set('goodWithCats', v)}
      />
      <OptionGroup<Compatibility>
        label="Good with children?"
        options={COMPATIBILITY_OPTIONS}
        value={draft.goodWithChildren}
        onChange={(v) => set('goodWithChildren', v)}
      />
      <TextField
        testID="wizard-children-notes"
        label="Notes about children"
        placeholder="Calm with a 10-year-old. No experience with toddlers."
        value={draft.childrenNotes}
        onChangeText={(v) => set('childrenNotes', v)}
        multiline
      />

      <OptionGroup<Compatibility>
        label="House-trained?"
        options={COMPATIBILITY_OPTIONS}
        value={draft.houseTrained}
        onChange={(v) => set('houseTrained', v)}
      />
      <OptionGroup<Compatibility>
        label="Crate-trained?"
        options={COMPATIBILITY_OPTIONS}
        value={draft.crateTrained}
        onChange={(v) => set('crateTrained', v)}
      />
      <OptionGroup<EnergyLevel>
        label="Energy level"
        options={ENERGY_LEVELS}
        value={draft.energyLevel}
        onChange={(v) => set('energyLevel', v)}
      />
    </View>
  );
}

/* ---------------------------------------------------------------- Step 4 */

function StepFour({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <View>
      {SPECIAL_PROMPTS.map((prompt) => (
        <TextField
          key={prompt.key}
          testID={`special-${prompt.key}`}
          label={prompt.label}
          placeholder={prompt.hint}
          value={draft.special[prompt.key]}
          onChangeText={(v) =>
            setDraft((d) => ({
              ...d,
              special: { ...d.special, [prompt.key]: v },
            }))
          }
          multiline={prompt.key === 'progressMade' || prompt.key === 'idealHome'}
        />
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- Step 5 */

function StepFive({
  draft,
  set,
  existingFoster,
  onRecordAdoption,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  existingFoster?: Foster;
  onRecordAdoption: () => void;
}) {
  return (
    <View>
      <TextField
        testID="wizard-rescue"
        label="Shelter / Rescue name"
        placeholder="Second Chance Rescue"
        value={draft.rescueName}
        onChangeText={(v) => set('rescueName', v)}
      />
      <TextField
        testID="wizard-rescue-contact-name"
        label="Rescue contact name"
        placeholder="Adoption coordinator"
        value={draft.rescueContactName}
        onChangeText={(v) => set('rescueContactName', v)}
      />
      <TextField
        testID="wizard-city"
        label="City"
        placeholder="Asheville"
        value={draft.city}
        onChangeText={(v) => set('city', v)}
        hint="Use the rescue’s city — never your home address."
      />
      <TextField
        testID="wizard-state"
        label="State"
        placeholder="NC"
        value={draft.state}
        onChangeText={(v) => set('state', v)}
      />
      <TextField
        testID="wizard-url"
        label="Adoption URL"
        placeholder="rescue.org/adopt/pet-name"
        value={draft.adoptionUrl}
        onChangeText={(v) => set('adoptionUrl', v)}
      />
      <TextField
        testID="wizard-adoption-email"
        label="Adoption email"
        placeholder="adopt@rescue.org"
        value={draft.adoptionEmail}
        onChangeText={(v) => set('adoptionEmail', v)}
      />
      <TextField
        testID="wizard-adoption-phone"
        label="Adoption phone"
        placeholder="(555) 555-5555"
        value={draft.adoptionPhone}
        onChangeText={(v) => set('adoptionPhone', v)}
      />
      <TextField
        testID="wizard-contact"
        label="Contact method"
        placeholder="Email the rescue"
        value={draft.contactMethod}
        onChangeText={(v) => set('contactMethod', v)}
      />
      <TextField
        testID="wizard-adoption-instructions"
        label="Adoption instructions"
        placeholder="Optional next steps for interested adopters"
        value={draft.adoptionInstructions}
        onChangeText={(v) => set('adoptionInstructions', v)}
        multiline
      />
      <TextField
        testID="wizard-fee"
        label="Adoption fee"
        placeholder="$250"
        value={draft.adoptionFee}
        onChangeText={(v) => set('adoptionFee', v)}
      />
      {existingFoster?.adoptionStatus === 'Adopted' ? (
        <View testID="wizard-adopted-status-locked" className="mb-5 rounded-3xl bg-forest-soft p-4">
          <FieldLabel>Current placement status</FieldLabel>
          <Text className="font-display text-xl text-forest">Adopted</Text>
          <Text className="mt-1.5 font-sans text-sm leading-[20px] text-ink-soft">
            Adoption history is protected here. Use Reactivate Foster from this profile if they return.
          </Text>
        </View>
      ) : (
        <>
          <OptionGroup<AdoptionStatus>
            label="Current placement status"
            options={ADOPTION_STATUSES.filter((status) => status !== 'Adopted')}
            value={draft.adoptionStatus}
            onChange={(v) => set('adoptionStatus', v)}
            hint="This is the verified Current Status shown on the profile. Placement is always the rescue’s decision."
          />
          {existingFoster ? (
            <View testID="wizard-record-adoption" className="-mt-1 mb-5 rounded-3xl border border-forest/10 bg-forest-soft p-4">
              <Text className="font-display text-lg text-forest">Has this foster been adopted?</Text>
              <Text className="mt-1 font-sans text-sm leading-[20px] text-ink-soft">
                Record the adoption date in Add Update so we can complete the foster period and preserve the full history.
              </Text>
              <Button
                testID="wizard-record-adoption-action"
                label="Record Adoption in Add Update"
                size="md"
                className="mt-3"
                onPress={onRecordAdoption}
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/* ---------------------------------------------------------------- Step 6 */

function StepSix({
  draft,
  toggleIn,
}: {
  draft: Draft;
  toggleIn: (key: 'personality' | 'considerations', value: string) => void;
}) {
  return (
    <View>
      <ChipRow>
        {CONSIDERATIONS.map((item) => (
          <Chip
            key={item}
            testID={`consideration-${item}`}
            label={item}
            showCheck
            selected={draft.considerations.includes(item)}
            onPress={() => toggleIn('considerations', item)}
          />
        ))}
      </ChipRow>
      <View className="mt-6 rounded-3xl bg-beige p-4">
        <Text className="font-medium text-base leading-[20px] text-ink-soft">
          We never hide medical or behavioral information. Naming a challenge here lets us give you
          a promotion plan built for it.
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------ Completion */

function CompletionScreen({
  petName,
  fosterId,
  wasEditing,
}: {
  petName: string;
  fosterId: string | null;
  wasEditing: boolean;
}) {
  const router = useRouter();

  return (
    <Screen testID="wizard-complete-screen" edges={['top', 'bottom']}>
      <PawPattern color={colors.clay} height={420} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center py-12">
          <Animated.View
            entering={FadeIn.duration(500)}
            className="mb-7 h-24 w-24 items-center justify-center rounded-full bg-forest"
            style={softShadow}
          >
            <PartyPopper size={42} color={colors.cream} strokeWidth={2} />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(120).duration(500)}
            className="text-center font-display text-4xl leading-[46px] text-forest"
          >
            {wasEditing
              ? `${petName}’s profile is updated!`
              : `${petName} is ready to become Foster Famous!`}
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(240).duration(500)}
            className="mt-4 text-center font-sans text-lg leading-[26px] text-ink-soft"
          >
            {wasEditing
              ? 'Every change you made has been saved to their profile.'
              : 'Their profile is saved. Pick where you’d like to start — a first post, or the 30-day promotion plan.'}
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.delay(360).duration(500)}
            className="mt-8 w-full flex-row items-center justify-center"
          >
            <View className="h-8 flex-row items-center rounded-full bg-forest-soft px-3">
              <Check size={14} color={colors.forest} strokeWidth={3} />
              <Text className="ml-1.5 font-bold text-sm text-forest">Profile saved</Text>
            </View>
            <View className="ml-2 h-8 flex-row items-center rounded-full bg-clay-soft px-3">
              <PawPrint size={13} color={colors.clayDeep} strokeWidth={2.6} />
              <Text className="ml-1.5 font-bold text-sm text-clay-deep">Day 1 unlocked</Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(480).duration(500)}>
          {wasEditing && fosterId ? (
            <Button
              testID="complete-view-profile"
              label="View Updated Profile"
              onPress={() => router.replace(`/foster/${fosterId}`)}
            />
          ) : (
            <>
              <Button
                testID="complete-create-post"
                label="Create First Post"
                onPress={() =>
                  router.replace({
                    pathname: '/create/editor',
                    params: {
                      kind: 'Day 1 — Meet Me',
                      fosterId: fosterId ?? undefined,
                    },
                  })
                }
              />
              <Button
                testID="complete-start-plan"
                label="Start 30-Day Plan"
                variant="secondary"
                className="mt-3"
                onPress={() => router.replace('/(tabs)/plan')}
              />
            </>
          )}
          <PressableScale
            testID="complete-go-home"
            accessibilityRole="button"
            haptic={false}
            onPress={() => router.replace('/(tabs)/home')}
            className="mt-3 h-12 items-center justify-center"
          >
            <Text className="font-bold text-lg text-forest underline">Go to Home</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
