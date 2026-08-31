<?php

namespace Tests;

/**
 * Boots the application as the public web build.
 *
 * APP_PLATFORM is read while config loads, which happens before any test body
 * runs, so it has to be in the environment before the application is created -
 * setting config('app.platform') inside a test would come too late to change
 * which routes and Fortify features were registered.
 */
abstract class WebPlatformTestCase extends TestCase
{
    protected function setUp(): void
    {
        putenv('APP_PLATFORM=web');
        $_ENV['APP_PLATFORM'] = 'web';
        $_SERVER['APP_PLATFORM'] = 'web';

        parent::setUp();
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        putenv('APP_PLATFORM');
        unset($_ENV['APP_PLATFORM'], $_SERVER['APP_PLATFORM']);
    }
}
