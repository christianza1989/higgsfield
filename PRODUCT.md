# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

The owner creates short videos locally using a chosen voice, subject photos,
location images and additional wardrobe/prop references. The requested flow is
Lithuanian, with explicit reference roles, weather and detailed environment text.

## Operating context

Existing Next.js studio on loopback, Seedance 2.5 through OpenRouter, Higgsfield
media storage and a sibling Voiceovers app. Preserve existing studio, ad editing,
library and settings. New guided workflow lives at /create.

## Capabilities and constraints

The requested interface must select an available cloned voice or a finished MP3,
accept face/location/other photos and prepare all references before generation.
Search real locations when no location photos are supplied; create fictional
environments from their description. Never invent a location match or a license.
Provider credentials remain server-side. Billable video generation follows a
visible quote. Exact Lithuanian lip synchronization requires result review.

## Product principles

- Separate spoken words from scene direction.
- Make each reference's purpose explicit and editable.
- Preserve prepared recordings and measured timings.
- Show actionable missing-credential and provider errors.
