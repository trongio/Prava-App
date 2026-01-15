<?php

namespace App\Console\Commands;

use App\Models\Question;
use Illuminate\Console\Command;

class CropQuestionImages extends Command
{
    protected $signature = 'app:crop-question-images
                            {--dry-run : Show what would be done without actually cropping}
                            {--backup : Create backup of original images}
                            {--id=* : Process only specific question IDs}
                            {--quality=75 : JPEG/WebP quality 1-100 (default 75, good balance)}';

    protected $description = 'Crop question images from bottom based on is_short_image flag';

    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $createBackup = $this->option('backup');

        $imagePath = public_path('images/ticket_images');
        $backupPath = public_path('images/ticket_images_backup');

        if ($createBackup && ! $isDryRun && ! is_dir($backupPath)) {
            mkdir($backupPath, 0755, true);
            $this->info("Created backup directory: {$backupPath}");
        }

        $query = Question::query()
            ->whereNotNull('image')
            ->where('image', '!=', '');

        $ids = $this->option('id');
        if (! empty($ids)) {
            $query->whereIn('id', $ids);
        }

        $questions = $query->get();

        $this->info("Found {$questions->count()} questions with images");

        $processed = 0;
        $skipped = 0;
        $errors = 0;

        $progressBar = $this->output->createProgressBar($questions->count());
        $progressBar->start();

        foreach ($questions as $question) {
            $filePath = $imagePath.'/'.$question->image;

            if (! file_exists($filePath)) {
                $this->newLine();
                $this->warn("Image not found: {$question->image} (Question ID: {$question->id})");
                $skipped++;
                $progressBar->advance();

                continue;
            }

            // Determine crop amount based on is_short_image
            $cropFromBottom = $question->is_short_image ? 402 : 90;

            if ($isDryRun) {
                $this->newLine();
                $this->info("Would crop {$cropFromBottom}px from bottom of {$question->image} (is_short_image: ".($question->is_short_image ? 'true' : 'false').')');
                $processed++;
                $progressBar->advance();

                continue;
            }

            try {
                // Create backup if requested
                if ($createBackup) {
                    copy($filePath, $backupPath.'/'.$question->image);
                }

                // Crop the image
                $quality = (int) $this->option('quality');
                $this->cropImageFromBottom($filePath, $cropFromBottom, $quality);
                $processed++;
            } catch (\Exception $e) {
                $this->newLine();
                $this->error("Failed to process {$question->image}: {$e->getMessage()}");
                $errors++;
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine(2);

        $this->info('Summary:');
        $this->info("  Processed: {$processed}");
        $this->info("  Skipped (not found): {$skipped}");
        $this->info("  Errors: {$errors}");

        if ($isDryRun) {
            $this->warn('This was a dry run. No images were modified.');
        }

        return self::SUCCESS;
    }

    private function cropImageFromBottom(string $filePath, int $cropPixels, int $quality = 75): void
    {
        $imageInfo = getimagesize($filePath);

        if ($imageInfo === false) {
            throw new \Exception('Could not read image info');
        }

        $width = $imageInfo[0];
        $height = $imageInfo[1];
        $mimeType = $imageInfo['mime'];

        // Calculate new height
        $newHeight = $height - $cropPixels;

        if ($newHeight <= 0) {
            throw new \Exception("Crop amount ({$cropPixels}px) is greater than or equal to image height ({$height}px)");
        }

        // Load image based on type
        $sourceImage = match ($mimeType) {
            'image/jpeg' => imagecreatefromjpeg($filePath),
            'image/png' => imagecreatefrompng($filePath),
            'image/gif' => imagecreatefromgif($filePath),
            'image/webp' => imagecreatefromwebp($filePath),
            default => throw new \Exception("Unsupported image type: {$mimeType}"),
        };

        if ($sourceImage === false) {
            throw new \Exception('Failed to load image');
        }

        // Create new image with cropped dimensions
        $croppedImage = imagecreatetruecolor($width, $newHeight);

        if ($croppedImage === false) {
            imagedestroy($sourceImage);
            throw new \Exception('Failed to create cropped image');
        }

        // Preserve transparency for PNG
        if ($mimeType === 'image/png') {
            imagealphablending($croppedImage, false);
            imagesavealpha($croppedImage, true);
            $transparent = imagecolorallocatealpha($croppedImage, 0, 0, 0, 127);
            imagefill($croppedImage, 0, 0, $transparent);
        }

        // Copy the top portion of the image (excluding bottom pixels)
        imagecopy(
            $croppedImage,
            $sourceImage,
            0,
            0,    // Destination X, Y
            0,
            0,    // Source X, Y
            $width,
            $newHeight // Width and height to copy
        );

        // Enable progressive JPEG for better compression and loading
        if ($mimeType === 'image/jpeg') {
            imageinterlace($croppedImage, true);
        }

        // Save the cropped image with optimized quality
        $result = match ($mimeType) {
            'image/jpeg' => imagejpeg($croppedImage, $filePath, $quality),
            'image/png' => imagepng($croppedImage, $filePath, 9),
            'image/gif' => imagegif($croppedImage, $filePath),
            'image/webp' => imagewebp($croppedImage, $filePath, $quality),
            default => false,
        };

        imagedestroy($sourceImage);
        imagedestroy($croppedImage);

        if (! $result) {
            throw new \Exception('Failed to save cropped image');
        }
    }
}
