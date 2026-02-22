import React from 'react';
import { Image, Text, View } from 'react-native';

type AvatarProps = {
    uri?: string | null;
    name: string | null;
    size?: number;
};

const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 64 }) => {
    const initials = name
        ? name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : '??';

    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                className="bg-gray-200"
            />
        );
    }

    return (
        <View
            style={{ width: size, height: size, borderRadius: size / 2 }}
            className="bg-indigo-600 justify-center items-center"
        >
            <Text
                style={{ fontSize: size * 0.4 }}
                className="text-white font-bold"
            >
                {initials}
            </Text>
        </View>
    );
};

export default Avatar;
