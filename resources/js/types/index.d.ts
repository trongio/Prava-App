import { InertiaLinkProps } from '@inertiajs/react';
import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface LicenseType {
    id: number;
    code: string;
    name: string;
    children?: LicenseType[];
}

export interface SharedData {
    name: string;
    auth: Auth;
    sidebarOpen: boolean;
    licenseTypes: LicenseType[];
    // Native navigation props (used by app.blade.php for NativePHP TopBar/BottomNav)
    pageTitle?: string;
    pageSubtitle?: string;
    showBackButton?: boolean;
    showTopBar?: boolean;
    showBottomNav?: boolean;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string | null;
    avatar?: string;
    profile_image_url?: string | null;
    has_password?: boolean;
    default_license_type_id?: number | null;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
}
