import React, { useEffect, useRef } from "react";
import { Modal, View, Text, Animated, Easing, useColorScheme } from "react-native";

interface LoaderModalProps {
  visible: boolean;
  message?: string;
}

const LoaderModal: React.FC<LoaderModalProps> = ({
  visible,
  message = "This may take a few moments. Please wait.",
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (visible) {
      animation.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.current.start();
    } else {
      animation.current?.stop();
      spinValue.setValue(0);
    }
  }, [visible]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const isDark = colorScheme === "dark";
  const bgCard = isDark ? "bg-slate-800" : "bg-white";
  const text1 = isDark ? "text-slate-50" : "text-slate-800";
  const text2 = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black/40 items-center justify-center">
        <View
          className={`w-4/5 rounded-2xl items-center p-6 ${bgCard}`}
        >
          {/* 🌀 Animated Arc Loader */}
          <Animated.View
            style={{
              transform: [{ rotate: spin }],
            }}
            className="w-12 h-12 mb-4 rounded-full border-[5px] border-t-indigo-600 border-b-indigo-600 border-l-transparent border-r-transparent"
          />

          <Text className={`text-xl font-bold text-center ${text1}`}>
            Processing...
          </Text>

          <Text className={`text-sm mt-1 text-center ${text2}`}>
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

export default LoaderModal;
