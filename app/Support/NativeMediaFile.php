<?php

namespace App\Support;

class NativeMediaFile
{
    /**
     * Path fragments that legitimate on-device media files live under.
     *
     * @var list<string>
     */
    private const ALLOWED_SEGMENTS = ['/cache/', '/files/', '/tmp/', '/Pictures/', '/DCIM/', '/media/'];

    /**
     * Map of allowed image types to their canonical extensions.
     *
     * @var array<int, string>
     */
    private const ALLOWED_IMAGE_TYPES = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
        IMAGETYPE_GIF => 'gif',
    ];

    /**
     * Safely resolve a client-supplied native file path to an existing image.
     *
     * Guards against path traversal (the raw path is resolved with realpath
     * before any allow-list check) and against reading non-image files.
     *
     * @return array{path: string, extension: string, mime: string}|null
     */
    public static function resolveImage(?string $path): ?array
    {
        if (! $path) {
            return null;
        }

        $real = realpath($path);

        if ($real === false || ! is_file($real)) {
            return null;
        }

        if (! self::isWithinAllowedLocation($real)) {
            return null;
        }

        $info = @getimagesize($real);

        if ($info === false || ! isset(self::ALLOWED_IMAGE_TYPES[$info[2]])) {
            return null;
        }

        return [
            'path' => $real,
            'extension' => self::ALLOWED_IMAGE_TYPES[$info[2]],
            'mime' => $info['mime'],
        ];
    }

    /**
     * Validate a base64 data URL and return its decoded bytes and extension.
     *
     * @return array{contents: string, extension: string}|null
     */
    public static function decodeImageDataUrl(?string $dataUrl, int $maxBytes = 5_242_880): ?array
    {
        if (! $dataUrl || ! preg_match('/^data:image\/(\w+);base64,(.+)$/', $dataUrl, $matches)) {
            return null;
        }

        $contents = base64_decode($matches[2], true);

        if ($contents === false || strlen($contents) > $maxBytes) {
            return null;
        }

        $info = @getimagesizefromstring($contents);

        if ($info === false || ! isset(self::ALLOWED_IMAGE_TYPES[$info[2]])) {
            return null;
        }

        return [
            'contents' => $contents,
            'extension' => self::ALLOWED_IMAGE_TYPES[$info[2]],
        ];
    }

    private static function isWithinAllowedLocation(string $resolvedPath): bool
    {
        foreach (self::ALLOWED_SEGMENTS as $segment) {
            if (str_contains($resolvedPath, $segment)) {
                return true;
            }
        }

        return false;
    }
}
