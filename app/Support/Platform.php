<?php

namespace App\Support;

/**
 * Which build of the app is currently running.
 *
 * The device build ships an offline, single-device database where picking a
 * profile is the whole login. The web build is shared by everyone on the
 * internet, so it needs real accounts instead. Both come from this codebase,
 * and the APP_PLATFORM env var decides which behaviour is wired up.
 */
class Platform
{
    public const WEB = 'web';

    public const NATIVE = 'native';

    public static function current(): string
    {
        return config('app.platform') === self::WEB ? self::WEB : self::NATIVE;
    }

    public static function isWeb(): bool
    {
        return self::current() === self::WEB;
    }

    public static function isNative(): bool
    {
        return self::current() === self::NATIVE;
    }
}
