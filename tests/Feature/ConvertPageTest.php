<?php

namespace Tests\Feature;

use Tests\TestCase;

class ConvertPageTest extends TestCase
{
    public function test_convert_page_includes_upload_and_audio_export_controls(): void
    {
        $response = $this->get('/convert');

        $response
            ->assertOk()
            ->assertViewIs('tools.convert')
            ->assertSee('data-audio-converter', false)
            ->assertSee('data-audio-upload', false)
            ->assertSee('data-file-input', false)
            ->assertSee('data-convert-export', false)
            ->assertSee('data-convert-format', false)
            ->assertSee('value="mp3" selected', false)
            ->assertSee('data-convert-filename', false)
            ->assertSee('data-convert-export-button', false)
            ->assertSee('convert-export-panel', false)
            ->assertSee('data-crop-change', false)
            ->assertSee('role="status"', false)
            ->assertSee('Je bestand wordt lokaal op je apparaat verwerkt en niet geüpload.');
    }
}
