import { Feather } from '@expo/vector-icons';
import { Image, Linking, Pressable, Text, View } from 'react-native';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.expensegauge';

const FEATURES: { icon: keyof typeof Feather.glyphMap; title: string; text: string }[] = [
  { icon: 'zap', title: 'Every expense in seconds', text: 'Credits, debits and bulk entries, even when you are offline.' },
  { icon: 'users', title: 'Split with groups', text: 'Trips, flats and plans. See who owes whom and settle in fewer payments.' },
  { icon: 'pie-chart', title: 'Know where it goes', text: 'Monthly trends and spending by category and account.' },
  { icon: 'smartphone', title: 'Same data everywhere', text: 'Pick up on the web right where you left off on your phone.' },
];

/** Left half of the sign-in pages on a desktop browser. */
export default function AuthBrandPanel() {
  return (
    <View className="flex-1 bg-indigo-950 justify-between" style={{ paddingHorizontal: 64, paddingVertical: 48 }}>
      <View className="flex-row items-center gap-3">
        <Image source={require('../../assets/images/icon1.png')} style={{ width: 44, height: 38 }} resizeMode="contain" />
        <Text className="text-white text-xl font-bold">ExpenseGauge</Text>
      </View>

      <View style={{ maxWidth: 520 }}>
        <Text className="text-white font-bold" style={{ fontSize: 44, lineHeight: 52 }}>
          Your money,{'\n'}at a glance.
        </Text>
        <Text className="text-indigo-200 text-lg mt-4">
          Track spending, split shared costs and see where your money goes.
        </Text>

        <View className="mt-10 gap-6">
          {FEATURES.map((feature) => (
            <View key={feature.title} className="flex-row gap-4">
              <View className="w-10 h-10 rounded-xl bg-indigo-500/20 items-center justify-center">
                <Feather name={feature.icon} size={18} color="#a5b4fc" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">{feature.title}</Text>
                <Text className="text-indigo-200/80 text-sm mt-0.5">{feature.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Pressable onPress={() => Linking.openURL(PLAY_STORE_URL)} className="flex-row items-center gap-2 self-start">
        <Feather name="download" size={16} color="#c7d2fe" />
        <Text className="text-indigo-200 text-sm">Also on Android: get it on Google Play</Text>
      </Pressable>
    </View>
  );
}
