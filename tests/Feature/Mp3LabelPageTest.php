<?php

namespace Tests\Feature;

use Tests\TestCase;

class Mp3LabelPageTest extends TestCase
{
    public function test_mp3_label_page_has_optional_controls_for_extra_images(): void
    {
        $this->get('/mp3-label')
            ->assertOk()
            ->assertViewIs('tools.mp3-label')
            ->assertSee('data-extra-pictures hidden', false)
            ->assertSee('data-extra-picture-list', false)
            ->assertSee('value="keep"', false)
            ->assertSee('value="replace"', false)
            ->assertSee('value="remove"', false);
    }
}
