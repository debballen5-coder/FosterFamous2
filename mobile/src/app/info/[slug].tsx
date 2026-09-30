import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  HeartHandshake,
  Info,
  LockKeyhole,
  Mail,
  PawPrint,
  Scale,
  ShieldCheck,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PawPattern } from '@/components/PawPattern';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/Field';
import { PressableScale } from '@/components/ui/Pressables';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { FAQS, PRIVACY_SECTIONS, RESOURCE_GUIDES, TERMS_SECTIONS, type InfoAction } from '@/lib/info-content';
import { goBackOrReplace } from '@/lib/navigation';
import { EMPTY_RESCUE_INFORMATION, useAppStore, type DefaultRescueInformation } from '@/lib/state/app-store';
import { colors, softShadow } from '@/lib/theme';
import type { FosterPreference } from '@/lib/types';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;

function titleForSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function iconForSlug(slug: string) {
  if (slug === 'privacy') return LockKeyhole;
  if (slug === 'terms') return Scale;
  if (slug === 'help') return CircleHelp;
  if (slug === 'contact-support') return Mail;
  if (slug === 'about-foster-famous') return Info;
  if (slug === 'rescue-information') return HeartHandshake;
  if (slug === 'foster-preferences') return PawPrint;
  return BookOpen;
}

export default function InfoScreen() {
  const router = useRouter();
  const { slug: rawSlug } = useLocalSearchParams<{ slug?: string }>();
  const slug = rawSlug ?? 'not-found';
  const guide = RESOURCE_GUIDES[slug];
  const Icon = iconForSlug(slug);
  const title = guide?.title ?? titleForSlug(slug);

  return (
    <Screen testID="info-screen" edges={['top']}>
      <ScreenHeader onBack={() => goBackOrReplace(router, '/(tabs)/more')} />
      <PawPattern color={colors.forest} height={300} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)}>
          <View className="h-14 w-14 items-center justify-center rounded-3xl bg-forest">
            <Icon size={24} color={colors.cream} strokeWidth={2.1} />
          </View>
          <Text className="mt-4 font-display text-4xl leading-[46px] text-forest">{title}</Text>
        </Animated.View>

        {guide ? <ResourceContent guide={guide} /> : null}
        {slug === 'foster-preferences' ? <FosterPreferences /> : null}
        {slug === 'rescue-information' ? <RescueInformation /> : null}
        {slug === 'help' ? <HelpContent /> : null}
        {slug === 'privacy' ? <LegalContent intro="This policy describes the app as it works today. It is not a substitute for a future hosted public policy." sections={PRIVACY_SECTIONS} /> : null}
        {slug === 'terms' ? <LegalContent intro="These plain-language terms describe the current Foster Famous experience." sections={TERMS_SECTIONS} /> : null}
        {slug === 'contact-support' ? <ContactSupport /> : null}
        {slug === 'about-foster-famous' ? <AboutContent /> : null}
        {!guide && !['foster-preferences', 'rescue-information', 'help', 'privacy', 'terms', 'contact-support', 'about-foster-famous'].includes(slug) ? <MissingInfo /> : null}

        <Animated.View entering={FadeInDown.delay(180).duration(360)} className="mt-7">
          <Button testID="info-back" label="Back to More" variant="secondary" onPress={() => goBackOrReplace(router, '/(tabs)/more')} />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function ResourceContent({ guide }: { guide: (typeof RESOURCE_GUIDES)[string] }) {
  const router = useRouter();
  const activeFosterId = useAppStore((state) => state.activeFosterId);
  const action = (item: InfoAction) => {
    if (item.route === '/create/editor') {
      router.push({
        pathname: item.route,
        params: { ...(item.kind ? { kind: item.kind } : {}), ...(activeFosterId ? { fosterId: activeFosterId } : {}) },
      });
      return;
    }
    router.push(item.route);
  };

  return (
    <Animated.View entering={FadeInDown.delay(70).duration(360)}>
      <Text className="mt-2.5 font-sans text-lg leading-[26px] text-ink-soft">{guide.intro}</Text>
      {guide.sections.map((section) => (
        <Card key={section.heading} tone="beige" className="mt-6" raised={false}>
          <Text className="font-display text-2xl text-forest">{section.heading}</Text>
          <View className="mt-4 gap-3">
            {section.points.map((point) => <Bullet key={point} text={point} />)}
          </View>
        </Card>
      ))}
      {guide.action ? <Button testID="resource-primary-action" label={guide.action.label} className="mt-5" onPress={() => action(guide.action!)} /> : null}
    </Animated.View>
  );
}

function Bullet({ text }: { text: string }) {
  return <View className="flex-row"><View className="mt-1.5 h-4 w-4 items-center justify-center rounded-full bg-forest"><Check size={10} color={colors.cream} strokeWidth={3} /></View><Text className="ml-2.5 flex-1 font-sans text-base leading-[22px] text-ink-soft">{text}</Text></View>;
}

function FosterPreferences() {
  const preference = useAppStore((state) => state.fosterPreference);
  const setFosterPreference = useAppStore((state) => state.setFosterPreference);
  const [saved, setSaved] = useState<boolean>(false);
  const options: readonly { value: FosterPreference; label: string }[] = [{ value: 'dogs', label: 'Dogs' }, { value: 'cats', label: 'Cats' }, { value: 'both', label: 'Both' }];

  return <Animated.View entering={FadeInDown.delay(70).duration(360)}><Text className="mt-2.5 font-sans text-lg leading-[26px] text-ink-soft">Choose the types of fosters you most often care for. We may use this to tailor examples and guidance.</Text><Card tone="beige" className="mt-6" raised={false}><Text className="font-bold text-base text-forest">Fosters you most often care for</Text><View className="mt-4"><ChipRow>{options.map((option) => <Chip key={option.value} testID={`foster-preference-${option.value}`} label={option.label} selected={preference === option.value} showCheck onPress={() => { setFosterPreference(option.value); setSaved(true); }} />)}</ChipRow></View>{saved ? <Text testID="foster-preference-saved" className="mt-4 font-bold text-sm text-forest">Saved on this device.</Text> : null}</Card></Animated.View>;
}

function RescueInformation() {
  const savedInformation = useAppStore((state) => state.defaultRescueInformation);
  const setDefaultRescueInformation = useAppStore((state) => state.setDefaultRescueInformation);
  const [draft, setDraft] = useState<DefaultRescueInformation>({ ...EMPTY_RESCUE_INFORMATION, ...savedInformation });
  const [saved, setSaved] = useState<boolean>(false);
  const update = (key: keyof DefaultRescueInformation, value: string) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false); };

  return <Animated.View entering={FadeInDown.delay(70).duration(360)}><Text className="mt-2.5 font-sans text-lg leading-[26px] text-ink-soft">Optional defaults help prefill new foster profiles. Existing foster profiles are never changed when you update these values.</Text><Card tone="beige" className="mt-6" raised={false}><TextField testID="rescue-default-name" label="Rescue / Shelter Name" value={draft.rescueName} placeholder="Second Chance Rescue" onChangeText={(value) => update('rescueName', value)} /><TextField testID="rescue-default-contact-name" label="Contact Name" value={draft.contactName} placeholder="Adoption coordinator" onChangeText={(value) => update('contactName', value)} /><TextField testID="rescue-default-website" label="Adoption Website" value={draft.adoptionWebsite} placeholder="rescue.org/adopt" onChangeText={(value) => update('adoptionWebsite', value)} /><TextField testID="rescue-default-email" label="Adoption Email" value={draft.adoptionEmail} placeholder="adopt@rescue.org" onChangeText={(value) => update('adoptionEmail', value)} /><TextField testID="rescue-default-phone" label="Phone" value={draft.phone} placeholder="(555) 555-5555" onChangeText={(value) => update('phone', value)} /><TextField testID="rescue-default-instructions" label="General Adoption Instructions" value={draft.instructions} placeholder="Optional next steps for adopters" onChangeText={(value) => update('instructions', value)} multiline /><Button testID="save-rescue-information" label="Save Default Information" onPress={() => { setDefaultRescueInformation(draft); setSaved(true); }} />{saved ? <Text testID="rescue-information-saved" className="mt-4 text-center font-bold text-sm text-forest">Defaults saved for new foster profiles.</Text> : null}</Card></Animated.View>;
}

function HelpContent() {
  return <Animated.View entering={FadeInDown.delay(70).duration(360)}><Text className="mt-2.5 font-sans text-lg leading-[26px] text-ink-soft">Quick answers for using Foster Famous with clear, current foster information.</Text><View className="mt-6 gap-3">{FAQS.map((faq) => <Card key={faq.question} tone="beige" raised={false}><Text className="font-bold text-base leading-[22px] text-forest">{faq.question}</Text><Text className="mt-2 font-sans text-base leading-[22px] text-ink-soft">{faq.answer}</Text></Card>)}</View></Animated.View>;
}

function LegalContent({ intro, sections }: { intro: string; sections: readonly { heading: string; body: string }[] }) {
  return <Animated.View entering={FadeInDown.delay(70).duration(360)}><Text className="mt-2.5 font-sans text-lg leading-[26px] text-ink-soft">{intro}</Text><View className="mt-6 gap-3">{sections.map((section) => <Card key={section.heading} tone="beige" raised={false}><Text className="font-bold text-base text-forest">{section.heading}</Text><Text className="mt-2 font-sans text-base leading-[22px] text-ink-soft">{section.body}</Text></Card>)}</View><View className="mt-5 rounded-3xl bg-forest p-5" style={softShadow}><View className="flex-row items-center"><ShieldCheck size={18} color={colors.cream} strokeWidth={2.4} /><Text className="ml-2 font-bold text-lg text-cream">Accuracy first</Text></View><Text className="mt-2 font-sans text-base leading-[22px] text-cream/85">Review generated content, keep information current, and never present unknown details as facts.</Text></View></Animated.View>;
}

function ContactSupport() {
  const [message, setMessage] = useState<string | null>(null);
  const openMail = async () => {
    if (!SUPPORT_EMAIL) return;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Foster Famous Support')}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(url);
    } catch {
      setMessage('We could not open your email app. Please try again from a device with email configured.');
    }
  };
  return <Animated.View entering={FadeInDown.delay(70).duration(360)}><Text className="mt-2.5 font-sans text-lg leading-[26px] text-ink-soft">We are here to help with the Foster Famous app.</Text><Card tone="beige" className="mt-6" raised={false}>{SUPPORT_EMAIL ? <><Text className="font-bold text-base text-forest">Support email</Text><Text testID="support-email" className="mt-1 font-sans text-base text-ink-soft">{SUPPORT_EMAIL}</Text><Button testID="email-support" label="Email Support" className="mt-5" icon={<Mail size={18} color={colors.cream} strokeWidth={2.4} />} onPress={() => void openMail()} /></> : <><Text className="font-bold text-base text-forest">Support contact is not configured</Text><Text className="mt-2 font-sans text-base leading-[22px] text-ink-soft">A production support email must be configured before release. No contact address is shown until one is available.</Text></>}{message ? <Text testID="support-email-error" className="mt-4 font-sans text-sm text-clay-deep">{message}</Text> : null}</Card></Animated.View>;
}

function AboutContent() {
  const router = useRouter();
  const version = Constants.expoConfig?.version;
  const rows = useMemo(() => [{ title: 'Privacy Policy', slug: 'privacy' }, { title: 'Terms of Use', slug: 'terms' }, { title: 'Contact Support', slug: 'contact-support' }], []);
  return <Animated.View entering={FadeInDown.delay(70).duration(360)}><Text className="mt-2.5 font-sans text-lg leading-[26px] text-ink-soft">Foster Famous helps foster parents create accurate, engaging adoption content, organize photos and videos, stay consistent with promotion, and keep foster information current.</Text><Card tone="beige" className="mt-6" raised={false}><Text className="font-display text-2xl text-forest">Foster Famous</Text><Text testID="about-version" className="mt-1 font-sans text-sm text-ink-muted">{version ? `Version ${version}` : 'Version information unavailable'}</Text><View className="mt-4 border-t border-hairline">{rows.map((row) => <PressableScale key={row.slug} testID={`about-${row.slug}`} accessibilityRole="button" onPress={() => router.push(`/info/${row.slug}`)} className="min-h-13 flex-row items-center justify-between border-b border-hairline py-3"><Text className="font-bold text-base text-forest">{row.title}</Text><ChevronRight size={18} color={colors.forest} strokeWidth={2.3} /></PressableScale>)}</View></Card></Animated.View>;
}

function MissingInfo() {
  return <Animated.View entering={FadeInDown.delay(70).duration(360)}><Card tone="beige" className="mt-6" raised={false}><Text className="font-display text-2xl text-forest">We couldn’t find that page.</Text><Text className="mt-2 font-sans text-base leading-[22px] text-ink-soft">Your foster information is safe. Return to More to choose an available guide or setting.</Text></Card></Animated.View>;
}
