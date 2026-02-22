import { View, Text, TouchableOpacity, useColorScheme } from "react-native";
import { FontAwesome } from '@expo/vector-icons';
import { Link } from "expo-router";
// import { Transaction } from "../types"; // you can adjust path
type Transaction = {
  _id: string;
  amount: number;
  date: string;
  details: string;
  type: string;
  category: string;
  isSynced: string | null
};

type Props = {
  item: Transaction;
  selectedId: string | null;
  type?: "admin" | "user";
  onSelect: (transaction: Transaction) => void;
  onDeletePress: () => void;
};

export default function ExpenseItem({ item, selectedId, type = "user", onSelect, onDeletePress }: Props) {
  const colorScheme = useColorScheme();
  const isSelected = selectedId === item._id;
  const isAdminAdded = item.type === "assign" && type === "admin";
  const isUserAdded = item.type !== "assign" && type === "user";
  return (
    <View className="mb-2">
      <TouchableOpacity
        className="dark:bg-gray-800 bg-white dark:border-0 border border-gray-200 p-4 rounded-lg dark:shadow-none shadow-lg"
        onPress={() => isAdminAdded || isUserAdded ? onSelect(item) : null}
      >
        <View className="flex-row justify-between">
          <Text className="dark:text-gray-100 flex-1 pr-10" numberOfLines={1}
            ellipsizeMode="tail">
            {item.details}
          </Text>

          <Text
            className={
              item.type === "debit"
                ? "dark:text-red-400 text-red-500"
                : "dark:text-green-400 text-green-500"
            }>
            {item.type === "debit" ? "-" : "+"} ₹{item.amount}
          </Text>
        </View>

        <View className="flex-row items-center mt-1 justify-between">
          <Text className="dark:text-gray-400 text-gray-700 text-sm flex-[0.4]" numberOfLines={1}>
            {new Date(item.date).toDateString()}
          </Text>

          {item.isSynced === "false" && (
            <Text className="text-xs text-red-500 flex-[0.3] text-center">
              ~ sync pending
            </Text>
          )}

          <View className="flex-[0.4] items-end">
            {item.type === "assign" && (
              <Text className="text-xs dark:text-gray-400 text-gray-500">
                ~ added by admin
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {isSelected && (
        <View className="flex-row">
          <TouchableOpacity
            className="dark:bg-red-600 bg-red-300 flex-row gap-2 -mt-1 py-2 px-4 items-center justify-start w-1/2"
            style={{ borderBottomLeftRadius: 8 }}
            onPress={onDeletePress}
          >
            <FontAwesome
              name="trash"
              size={15}
              color={colorScheme === "dark" ? "white" : "black"}
            />
            <Text className="dark:text-white text-sm font-semibold">Delete Transaction</Text>
          </TouchableOpacity>

          <Link
            href={{
              pathname: `/expenseModal/[type]`,
              params: { ...item },
            }}
            asChild
          >
            <TouchableOpacity
              className="dark:bg-indigo-900 bg-indigo-200 -mt-1 flex-row gap-2 py-2 px-4 items-center justify-end w-1/2"
              style={{ borderBottomRightRadius: 8 }}
            >
              <FontAwesome
                name="pencil"
                size={15}
                color={colorScheme === "dark" ? "white" : "black"}
              />
              <Text className="dark:text-white text-sm font-semibold">Edit Transaction</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
    </View>
  );
}
