-- Rollback for 20260904020001_campaign_real_cover_photos.
-- Restores the first-party generated cover for exactly the rows that
-- migration set, matched on the photo URL it wrote.

begin;
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-1-49b50f84'
  where id = '2c49c3f1-c132-4b1f-b441-2819058fe32f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQxOS0zLTA1ODcxYV8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-19-efce6d98'
  where id = 'f69afee9-8667-4f5b-a23b-78f1639d7b17'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg1MTAzNTgtaW1hZ2Uta3d2dmc0NHIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-55-03dc03e3'
  where id = '85af0408-c849-4cc1-9f69-92f63ddb6764'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZsMTExMDgwNTYwNDQtaW1hZ2Uta3drZm1rM3MuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-73-5bb91a82'
  where id = '6082d442-2052-4d23-ad73-04f1ed596e0a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3B4MzQwNjM3LWltYWdlLWt3dnhwM3RkLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-91-fb4fdfce'
  where id = 'bf12a4c7-cb14-44e6-988f-f67d55efe5dc'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMxMDYxMy1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-109-f98457e3'
  where id = 'a8c51920-7cbe-49f0-8ccd-486688877154'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2ZyaG9zcGl0YWxfY29ycmlkb3Jfb3BlcmF0aW5nX3Jvb20taW1hZ2Uta3liZGduaGsuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-145-cc2c136d'
  where id = '3c7b522f-da80-4678-918a-8a320d551c2e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg2MzM4NjMtaW1hZ2Uta3d2eGsyY2EuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-163-b210bb34'
  where id = '0bb0d2eb-1b0b-4320-a1de-db4701e5e587'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg2NjMyMDUtaW1hZ2Uta3d2eGt1YWcuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-181-6cb79ad1'
  where id = '2efb5444-d75a-49d8-9a05-5fc7d817f13a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3BkNThiYXRjaDMtY2hpbS0zMF8yLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-199-8e17d5a9'
  where id = '70f10c9b-70d9-47d0-88f3-caa4d8f2adae'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMzI0OTE3LWltYWdlLWt3dnkzeXZoLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-235-16855128'
  where id = '92654306-25a4-4c4b-a6f3-b8cfe5b4c36e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2xyL3VtZXN2a2duemc4NDAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-253-7d76ba48'
  where id = 'f6b720f4-f86a-4990-9cf4-dca23b8c3a5c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjcyOC0yMjAtdl8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-271-1247f6e5'
  where id = '1f6cf62e-c9c3-43b1-9822-a66bb8d80366'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjcyOC0yMjAtcC5wbmc.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-289-8794bab7'
  where id = 'b0736aaa-5dd0-4580-a56d-f15cab7db9ba'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyaG9zcGl0YWxfaW5mdXNpb25fZHJpcF9hbnRpYmlvdGljXzAtaW1hZ2Uta3liYmFkankuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-325-4fb65482'
  where id = 'e6d4f29f-d776-46a6-9ceb-780661f68c60'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMxODkyLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-343-9ca633cf'
  where id = '2d5d8790-cd78-4e08-847e-40a970ac7850'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djd25tdHFibW4taW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-361-92b5de73'
  where id = '13370954-787d-4513-8658-ccd745b071e4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNDE2NC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-379-30df7504'
  where id = '1aafca9b-eac0-494c-9494-f0670bb9b7f5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djdmZlYTlhNjUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-415-8ed1ec5c'
  where id = '2aa571c1-4618-400b-b430-2c46d08543e7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3BkNThiYXRjaDMtY2hpbS0xOV8zLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-433-ca01864d'
  where id = '4a7004ac-d142-42fc-9b23-7558a0490fba'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXM0NDkxLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-451-827f565b'
  where id = '8915d32d-3fb2-467c-8611-034d3ad5ce1b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MzQwNjQxLWltYWdlLWt3dnhwOG13LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-campaign-469-7975d255'
  where id = '311849ff-9ba6-498a-8bcc-86f794e2c5fd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djbWF0dTNzZmctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-support-my-medical-expenses-mscg7b2e'
  where id = '301b19f0-da36-412c-a748-a717f540e292'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djZjh3ZnFyN3ctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-50'
  where id = '11b5ccd7-cb1f-566d-bcd7-cd9c565d95a6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNDE3MS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-49'
  where id = 'f2ed57ce-4be8-577d-8e8c-89181440d20b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzMzUxMC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-48'
  where id = '2b65c547-ee13-5a6f-97f7-76af021104b8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djeGM5OGFqMjgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-47'
  where id = '283b28ae-4b99-568a-9b6e-7ae0c5d8ed74'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNTQwMC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-46'
  where id = '59a11b28-9449-5e39-b3ba-60547f55c14f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L2xyL2xvYzIwMDM2ODA1MzEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-45'
  where id = 'a53d255b-cf99-50ac-949f-b85a7c55adb6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQyMDctMS0wNDNfMS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-44'
  where id = '1c94e72d-8a32-585b-9bb8-a397a0c7fbbe'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djeWp4OHl1MnctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-43'
  where id = '80f73ae2-f4b3-539f-89dd-50c7a8ef5b5e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djajNnYmN3YmstaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-42'
  where id = '0095a681-fab1-51db-ab5b-8271d43bab39'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djeXlmOWdyaHktaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-41'
  where id = 'ea7c0322-bf78-54a7-be50-308299c2cf8c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djZ205OGVxY20taW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-40'
  where id = '191e579e-719c-5d16-b6e4-a0d621020bb3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djc3Z6NnE3YmstaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-39'
  where id = 'a688acce-86c1-57fd-904d-40204e79885e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNDc0NC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-38'
  where id = '9aca2ff4-e46c-5f3a-8f88-beaa07c87a32'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTk3MTE4OTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-37'
  where id = '894ffa6c-842b-56f4-8ca7-7582175ffd53'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djdWtwdG0yaG4taW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-36'
  where id = '0e6ef3f9-40c0-50dc-8360-22a789a5944e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDI0LTAyL3djbWszOXRxcmMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-35'
  where id = '3b596131-ad27-5a70-aea6-98d79aa8f42c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDk4OTE0MTQ3MDEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-34'
  where id = '25db458f-6e8b-5617-ad5f-8244f5a74e4d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjQxMzMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-33'
  where id = '0e2c0eb2-5019-5f46-905c-6b7d41704f68'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTk3MTE4OTUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-32'
  where id = '912afe24-e717-535d-bce5-86cc30219d64'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L21ldDI4NjA2Ni1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-31'
  where id = '922ee418-4666-5944-8219-41ba22764b24'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnoyMjU4MTAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-30'
  where id = '22a3d2d6-e2f4-5da8-a8d8-53576832b98b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MzQ3MDYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-29'
  where id = 'cffbd25f-a9a4-5309-a251-14d0f88f4956'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZyYmNuc25wMDIyLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-28'
  where id = '4514d7a0-ca68-5b9c-a3f5-20f1793747ac'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDI0LTAyL3djcXp6dW41d2gtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-27'
  where id = 'dbe4d0a2-4b0d-574b-8b8d-2f7b18d26f43'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDI0LTAyL3djbm1ldXp0NGItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-26'
  where id = '02a60e0c-4650-5324-b483-176ead345b56'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXM5OTQ0LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-25'
  where id = '5c8819e9-cae8-5b38-ae44-138d8b238702'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djbXZoYjN3a2staW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-24'
  where id = '8b6fdeaa-c382-53bb-9600-c17e9e7532e5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnoyMjU4MjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-23'
  where id = '7e042914-6a41-58b6-8b8b-0118c1e73eaa'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzMjUxMi1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-22'
  where id = 'fc5e8b4a-0cb1-54d2-88ea-04c681bee771'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTk3MTE4OTctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-21'
  where id = '60857a7d-431a-5c84-b39a-24230c3d0f90'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djZDR5eGRmcmQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-20'
  where id = 'e5c451f5-a2e3-554d-9f66-62b6477f283e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djcjZoemV1YzMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-19'
  where id = '12afcfeb-8820-5761-b690-935c422e1bc3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNDE2OC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-18'
  where id = '87b6b42e-b930-59f5-8515-6c112265ff3d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djZnM3Y2poMmEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-17'
  where id = '413e742b-2433-53b8-9a94-3a61dd206443'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4NDk2OTUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-16'
  where id = '30c59de4-4e7e-5df4-a2a7-31e9fce33b7c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djcW52MzllZWotaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-15'
  where id = 'c3ce7259-b955-57d8-a728-b39bed91c9d7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djd2o0YWFuNHYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-14'
  where id = 'aa06abb9-dfcd-5e4d-84aa-f43844a22f09'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djeXRjOWg3NDMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-13'
  where id = 'cc505ad5-1a2f-5799-91f0-736f3941cc44'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjU0NjItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-12'
  where id = '0b9bf063-aef1-57e9-ab63-9a908528c646'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djeGdhdW5mZjItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-11'
  where id = 'd763d1e9-48f2-5e2f-ba40-b95148026100'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djZ3B3anI2am0taW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-10'
  where id = 'be0f9a06-5564-58c2-b69e-fc84bf6ca689'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwxMjY1Nzg1ODcxMy1pbWFnZS1rcHFxM3poby5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-09'
  where id = '99730aa3-2e20-5e4e-be5d-eb3ba787e8ad'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djdHh0YnpycWUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-08'
  where id = 'a0fce022-02e8-5743-afc1-710d68f6c706'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djdXA4NXN1eWotaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-07'
  where id = 'b174ec1b-117c-5f51-9247-7037dc190de2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djY2IzdmQ3c3MtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-06'
  where id = '02c695d6-9052-5909-8c7d-61bb8751e67e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djamt3aDlybXAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-05'
  where id = '93354e62-2de3-5ce2-930c-788e96258445'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djdnhrOGh3NnotaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-04'
  where id = 'e82360b8-6a54-54fd-8800-e1f037250143'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2Zyc2FzaW50MDAwMjgtaW1hZ2Uta3d2d3lmZ2suanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-03'
  where id = '8114bf32-e5e9-5ab8-9e57-4ce316c9fcfa'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djYWtwNWRzNXEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-02'
  where id = 'a1c7a76a-7269-5b4e-92a4-0cfdd2d45b6c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djYXo2cGRoMjMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Medical&key=migration-20260903-charitme-example-health-wellness-01'
  where id = '792eef95-5999-5744-9c2c-d791524647ed'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djYmo0NHE3OG4taW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-2-1a6404ad'
  where id = '783d5834-d34b-4497-911b-6f251a5f9be6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0xMS9mbDEyMzA4MDEyMjM1LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-20-36677662'
  where id = 'f3ce93f2-76b6-4eec-94ee-a81c628b80ad'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw4MDk4MjQ2NTY3LWltYWdlLWt0d2ptd3pxLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-74-2d9d13c9'
  where id = '27b3cb05-0573-4c6a-889d-b153358c603a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODA4MTM1LXdpa2ltZWRpYS1pbWFnZS1rb3dib3h4bi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-92-e04999c5'
  where id = '21a1c092-669d-48af-bc58-0a315d146b14'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL3BkbWlzYzgtZGlnaXRhbGN3Y29tbW9ud2VhbHRoejg5MHJ3OTBzLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-110-be546009'
  where id = 'e4ebff87-6ef9-4c28-b15d-b4c37efc9e23'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODc3MTU2LXdpa2ltZWRpYS1pbWFnZS1rb3dkNHdldC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-164-8dd913fb'
  where id = '6ac76dbe-d46f-421e-b22c-6a52c2003f09'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHUyMzMyMjczLWltYWdlLWt3dnk5YzNhLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-182-7fc33701'
  where id = 'd4c54087-b2e2-49de-8cd9-37ba291cf6f4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODE1NTExLXdpa2ltZWRpYS1pbWFnZS1rb3djZTIydC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-200-d5681b72'
  where id = 'f2bdb64a-f814-41d8-9b89-2f3636983788'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3Vwd2s2MTgwNjYyOS13aWtpbWVkaWEtaW1hZ2Uta293Ym90cDcuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-254-a565162b'
  where id = 'afd881d5-b9f5-419f-8bc3-da552d313c1e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsMzI1NDc0Mzk4NjctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-272-8140f906'
  where id = 'fa35967f-49c8-4551-870c-97d4c4fabcc4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODA3NzAwLXdpa2ltZWRpYS1pbWFnZS1rb3dicjFreS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-290-689ab662'
  where id = 'ce6bbd17-b535-4ac9-9ccd-9faa300da5b6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQxMDMtbWlzY3RoZW1ldDAwMTQyLWltYWdlXzYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-344-c9ca6378'
  where id = '6a5b5605-736c-4449-845d-480e9a709575'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvZnJmbG93ZXJfbmF0dXJlX2RhaGxpYV9vcmFuZ2VfMC1pbWFnZS1qb2I2MzAtYV8xLWwwZzA0aXA5LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-362-de34ceeb'
  where id = '06f74d34-3799-456e-8ca5-57fe302598f6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxNjk4NTcwLXdpa2ltZWRpYS1pbWFnZS1rb3dsdm1wYS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-380-4c4265ab'
  where id = 'd0fa34c7-2df8-43ac-beef-5ed0cdc26c78'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3B4ODQyMzUzLWltYWdlLWt3dnhmajJhLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-434-c848b0a6'
  where id = 'b024dbb8-8167-4f38-9767-f6f716c54828'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMjM1MTQwLWltYWdlLWt3dnkyenRuLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-452-1a12e2c2'
  where id = '82bb0c3c-53cf-4fab-ba2d-c3b550ffa83c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTQxODg4Ni1pbWFnZS1rd3Z2enl2ci5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Memorial&key=migration-20260903-campaign-470-a64f3583'
  where id = '75363d3c-c189-4cb3-a3b9-7a3146a6c780'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmFvcmJpczEzNTc2NTU2LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-3-6d3a6fac'
  where id = '46f06d45-62f5-47d2-ae47-7dffa689580f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDc5OTM4MTg3MDItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-21-cf301a47'
  where id = '066846e5-9790-4904-8f05-5c253e5c06c4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDgzNzg5OTg4OTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-39-790f60f6'
  where id = 'eef02fd7-7aba-42e4-a02c-1d7c03f506a8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTIwNjQwNTY2MjQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-75-a19ee15a'
  where id = '94a0f658-6905-4583-9c83-f7b6e839d0d6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTIwNjM4NDY1MDMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-93-ac8761a8'
  where id = '4a3f5cc4-1493-425c-830d-b4f29c9715b3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDkzMjEyODMzMzYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-111-baeee5b7'
  where id = 'f02d5094-d1bb-4b3f-9007-4716d0c60f55'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDk2Mzk1NDk0NTItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-129-48d79110'
  where id = '7bd29ddc-ae6f-4ca7-8080-2c01b8f3e096'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTA5NzU5MzUwNTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-165-5b1ae611'
  where id = 'e7640b82-1f4e-4c4f-a415-9fa65be4093c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDY3MjAyNjM0NTUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-183-b924ff51'
  where id = 'c1bb3a99-2866-4f76-8c2f-3b73388584fb'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDk2NTY1NTcwNzctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-201-98a8de46'
  where id = 'a3596375-e81e-45f3-8b7d-173a1fb25701'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTA5MDIwNTI1NTEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-219-873ea402'
  where id = '59afc596-8287-45e1-8de1-f9eb67bf35d0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDk2NTYyODI2NTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-255-cb0029f2'
  where id = '9bd8617b-2d42-48e3-8bdd-c9e3e1cb2a32'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsMzI1MzU0NDkxOTctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-273-d676c942'
  where id = 'cd2cb8cb-2e27-4a25-9108-9e421c4922d7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDc2MzU4NzA3MjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-291-6514b49a'
  where id = 'd050521e-4766-400d-ac78-e202c333b7a5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsMzM1MDgzOTAxOTgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-309-ec4c79ef'
  where id = '74288812-df89-44b4-a40b-e1516bb14dbd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTA5NzU5OTI1ODctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-345-dd792298'
  where id = 'bd1f942b-d398-4f62-acda-ec6f67e931aa'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDc2NzUxNzc3MjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-363-906b399c'
  where id = 'e670ee73-3106-485b-a057-e91416a8f4a1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTA5NzU5MzIzNjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-381-245cd9fc'
  where id = 'ece0b03c-3dc7-4c9e-84b5-9a8e147b2a7b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDk2NTYyODYxODYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-399-8bbbc48d'
  where id = '5074fc77-408e-4099-8e51-866976cbf69a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg2OTgzMDktaW1hZ2Uta3d2eGh6eWguanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-435-8379149d'
  where id = '92fa798a-303b-477d-a146-10fc0bbee7ea'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsMzM3NTg1MDYyODgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-453-a4d58026'
  where id = 'ea855b3a-796e-4e6c-bbc8-98a4992025a0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDIyLTA3L2ZsNDc5NjQyODE1ODYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-471-25880480'
  where id = '015f7182-35d0-4764-9cb7-cb1b6b8333fd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTEwNjc0Njk1MDMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Emergency&key=migration-20260903-campaign-489-562e7f0f'
  where id = 'ead7787a-0e9c-4998-8b70-9886b528e91a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNTA5MDIwNDkzOTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-4-50f108d1'
  where id = '774d5352-2657-46a4-b040-cace8e0b75c9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg4ODUxODctaW1hZ2Uta3d2eGVrMHAuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-22-837d541b'
  where id = '4129f474-b936-4ffa-a258-aff9e8aa6c8d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsMjk3NzQ2MjgwNDMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-40-77a7634b'
  where id = '135e9c0a-3ecf-4905-a2ea-ff16b0e00e2a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMzUzNDcyLWltYWdlLWt3dnh5ZnMwLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-94-97427d56'
  where id = '93450fbd-9073-43c5-9848-599407569f94'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0OTc1NTE4OTUzNy1pbWFnZS1rdWNjczd6bC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-112-7127df7d'
  where id = '57879a33-924c-45a4-aa01-5be3fd0e1bb5'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL2pvYjk2Mi0wODMucG5n.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-130-01bfbeaa'
  where id = '1e01cfad-3b4d-4234-893b-5064a140664e'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw1MDA2NTg2NzE2Ny1pbWFnZS1rcHdiazhnNy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-184-b6c37017'
  where id = '8d42ef93-fc81-4f28-bc00-dd3b3e98d352'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg4ODUxODYtaW1hZ2Uta3d2eGJyNDkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-202-810717e0'
  where id = '9da0b95f-6b04-45b6-a646-ad248cb2e2d3'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZsNTAyNDg1Njc1OTgtaW1hZ2Uta3VjZ2h0dzUuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-220-bc681170'
  where id = '222010bf-8d9e-429d-ba8f-cea487e9d6c1'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyMTA4NDM4OTE3MC1pbWFnZS1rdWRpMzlpai5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-274-ba746c3d'
  where id = '0e1512cf-56c6-4867-ab4d-ba3eb1e8726e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDIyLTEwL21ldDM4MTExLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-292-ca7740d8'
  where id = 'aa402ff3-420a-4b9e-a31f-9f4b62d82cf5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L21pYTU3OTUwLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-310-4c6b529b'
  where id = '9a4d09b1-723f-42af-b9ef-ece56eb33bfd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAxL2xyL3JpamtzcnAtdC0xOTQ4LTM2OC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-364-1548b430'
  where id = 'a0bc05d4-9752-4a2b-b090-60cad5157565'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA2L3dpZW53X18yNTQzLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-382-5a9036a4'
  where id = '6d5356dc-e8a9-4276-ab98-2c9d5ef77219'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjQ2MjQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-400-e934818f'
  where id = '86bc68cd-0cf9-4ed2-b161-06cbe51676ba'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwzNzMwNzA4MTQ3MS1pbWFnZS1rcHFxMnoyei5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-454-856c8023'
  where id = '52bc128f-3985-44a1-97c1-1bcae279e29d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0wNS9sb2MyMDAxNzA2MTAzLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-472-180302e7'
  where id = '2010c7bd-4782-4899-9302-dbd1c645633a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L21ldDY1MDIxMi1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Nonprofit&key=migration-20260903-campaign-490-54ea20b2'
  where id = 'f25232a4-1558-46d5-a249-ecd88cb9e055'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDIyLTA5L21ldDM5MjIzMy1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-5-64a0db27'
  where id = 'ce0e1db8-ce77-4e51-bdaf-dcd0e0a428ab'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djdGJtamt0OGstaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-23-cc00aeb6'
  where id = '62da3209-5c53-4909-9269-7346a8e74b37'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMTYyOTAxLWltYWdlLWt3dnk0NzVyLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-41-c0104a82'
  where id = '118bd33e-8580-4c0b-b09e-9d210f6639e6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJtdWVsbGVyXzEtaW1hZ2Uta3liZDZ1eHIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-59-3645b3c8'
  where id = '1df9c959-e327-444a-ae9c-34b924fd07e6'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw1NDA3NzY2OTU1LWltYWdlLWtwdnhoamNzLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-95-1ef81719'
  where id = 'e36c1876-336f-4738-9f2c-767bd0265895'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvc2sxNzgtaW1hZ2Uta3d5bnB5YTkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-113-08f02a0e'
  where id = '19d9d98b-a42d-44ba-9e28-bcb2838c6d13'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY29tcHV0ZXJfcm9vbV9jb21wdXRlcl90cmFpbmluZy1pbWFnZS1reWJidGlwZi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-131-a5e6bbd4'
  where id = 'd811669d-78f6-4dca-a2ab-5543a30378a7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsMzcwMzU3MzYyOS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-149-cc0963a9'
  where id = 'a4b51017-e613-4286-a39d-b1ec650af8a4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsMzI0NzE3MjY1MjctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-185-c24ceb30'
  where id = '73ed871e-3987-4fb3-a2a2-12d96d1779e7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzODM4OS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-203-c1a9969f'
  where id = 'dbcb4484-5a4d-46d4-af75-08ff8501fc22'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2ZsMzEyMTU4ODMwODEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-221-08d1cee2'
  where id = '33e832e5-e0ff-46f3-9c4d-13465f888706'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2lzMTc3NDMtaW1hZ2Uta3d2d3VmN24uanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-239-46d35666'
  where id = '84b06f81-f91c-4494-92b3-f392bb4d2257'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4ODQ0NTMwLWltYWdlLWt3dnV4cXdwLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-275-c2fafb21'
  where id = 'b52d85b6-71ef-4691-911f-20beee211a26'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTI3NTgxMC1pbWFnZS1rd3Z3NTJtaC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-293-6950bc7e'
  where id = '0487593a-1eff-4e39-9074-c28cf632332b'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2pvYjk0OS0wMzktcC5wbmc.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-311-178b9eeb'
  where id = '67f3d455-e4e3-4751-8545-d054eec84aed'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxNzc0OS1pbWFnZS1rd3lzOWcxYy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-329-7f346890'
  where id = '750ff9c3-8dd4-4333-a834-dd4d2cf65ae8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg3NDU2MTctaW1hZ2Uta3d2eGd3ancuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-365-41b0a7ed'
  where id = 'a8fb2148-fc64-4923-bff1-24f98099c408'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNDcyNzUzNzI2OC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-383-7dd5d7ca'
  where id = '7e8d5cf5-e340-43f1-9095-997afeb136a3'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2ZsNDg1OTc2ODk4NS1pbWFnZS1rcWFtNHpseC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-401-7d708ded'
  where id = 'd31bd1c7-c901-416b-b915-d9a083230109'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg2NjgwNjMtaW1hZ2Uta3d2eGxmYXEuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-419-adb02814'
  where id = '69836cd7-8814-4d86-b6d9-5de2a90c49f1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJ1bnNwbGFzaDA0ODg0LWltYWdlLWt6MmR5cDgyLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-455-c95ea2c9'
  where id = 'b5c5d14f-6260-4763-bdf1-9739e2155ce4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2pvYjk1OS1lbGVtZW50LWEtMDEyNi1sYnZvdm83Yy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-473-d6e19f72'
  where id = 'd629feb8-926e-4e02-9444-254f5d290ec6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTE2NDc2ODE0NzgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-campaign-491-c366fcea'
  where id = '519db4d5-9b41-4f6e-ab70-7d3283cda52a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTk2OTUwNzQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-50'
  where id = 'b79d91f2-4453-5e80-9858-09a5ac7b126c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZydW5zcGxhc2gxNjczNS1pbWFnZS1rejJlMDhidy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-49'
  where id = '73204055-6934-5044-89b7-6bd3aad8e442'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0wNS9sb2M5MjUxOTc4Mi1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-48'
  where id = '815f711d-9853-5da1-975f-875124ff29b5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL2dldHR5MTA3NHFtLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-47'
  where id = '0e005488-6ac2-500b-baac-2406410de6db'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0MjIyNjIzNzA5Mi1pbWFnZS1rcHFvcG90Mi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-46'
  where id = 'a260d3c6-cf87-5e75-b663-89a4d062d271'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0Nzc1MTAxNTcxMS1pbWFnZS1rdWRpM2tqby5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-45'
  where id = 'eab9a1b8-4836-52bc-803b-f7b1ba7ce8da'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djeWZxdnFzeGgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-44'
  where id = 'd502eb1f-fde2-53ef-b245-8b2d441e6fd8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbG9jMjAxNzc4OTY2NS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-43'
  where id = '584075b2-3c45-5977-8648-e87e6c64d037'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0wNS9sb2MyMDAxNzA2MzA2LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-42'
  where id = 'f9857ca9-7453-5247-8077-862b4a473a38'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTk2OTM1NjMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-41'
  where id = 'dcc6d3dd-d7e5-546c-a334-a6ecad85a72b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTk2OTc1MjctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-40'
  where id = 'f147cbf5-35fb-5800-9232-5b7dd2cc8759'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L3BkbWlzYzQtcGRmYW1vdXNwYWludGluZ2V0YzA1ODAwMjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-39'
  where id = 'ce023e0f-3bf3-5ff0-8749-7e1cc49935e3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTEyL2xyL21vbnoxMDI5ODUwLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-38'
  where id = 'f15a78d8-5ff8-520f-b44f-6c46bf7d0d09'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMzQ1MTgyLWltYWdlLWt3eXFuZXRmLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-37'
  where id = 'c65aaf62-f3ff-5612-a1a9-51fff2167c34'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg4MDU4MzktaW1hZ2Uta3d2eGZvMm4uanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-36'
  where id = '67d2ccc6-6953-5afa-b0b6-0dab0a427715'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2ZsNjc2NjU2ODk4NS1pbWFnZS1rd2tmbmVpcS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-35'
  where id = '4c702fd3-853f-5ea7-968c-ed79105ad602'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJhdWRpdG9yaXVtX2NsYXNzcm9vbV9sZWN0dXJlXzU3Mjc3Ni1pbWFnZS1reWJlYzBwYy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-34'
  where id = 'a5dbe1b8-8420-5ea6-b243-e79a261fe0ef'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMDk0NzY4LWltYWdlLWt3eXQ5enByLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-33'
  where id = '594144ae-d694-56ab-b4cb-3ea3b8660f4e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg1OTYyOTAtaW1hZ2Uta3d5cDRqdzYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-32'
  where id = 'd8a7e3a8-0c01-56db-9871-d5e4fa55121e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTA2LzI1NjgwNjI5LXNtMzU4MDU3ZDMtaW1hZ2UtbWNpd3NyeW4uanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-31'
  where id = '11241ba9-3fa5-54fe-9741-1e71529f13bd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA4L2xyL3drOTMxMzE0OTQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-30'
  where id = '2c406c01-a754-556a-b1d0-14a59c730373'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMTYyODk0LWltYWdlLWt3eXIwMmVmLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-29'
  where id = 'd00d35a0-1575-51e2-81a3-001e57a74ea8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg5NjUyMjktaW1hZ2Uta3d2dXA1Y2IuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-28'
  where id = '53533b9d-ec31-5050-ade2-7ea007fe0f4a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNjE0MzAwMTMxNi1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-27'
  where id = 'f247876d-69f4-52eb-8d77-2ae4b17df709'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMxMTM1LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-26'
  where id = '4afe109a-e311-58f2-aefb-35d7b79ebc31'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMDUyMjY2LWltYWdlLWt3eXJmaXQ5LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-25'
  where id = '26aaf450-ab14-5a86-ac0c-65a1bc443173'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djZjdxeTJtODktaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-24'
  where id = '5ef2c6fb-5f0a-5d8f-b6ba-31a629039aa3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfc3BhY2VfY2hhaXJzX3dlZGRpbmctaW1hZ2Uta3liZHl5b2kuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-23'
  where id = '5be71a0f-6124-5f96-a45e-986d247891f5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMzMxMTM2LWltYWdlLWt3eXFwY3ozLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-22'
  where id = 'ca327a57-ba50-537f-9a9c-bb7ab1281a5d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwxOTkxNTE5OTczOC1pbWFnZS1reWJlbHh0dC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-21'
  where id = '58e88b00-9d55-5702-a4be-0d9e58a0e5b7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw5NTgyNTIzOTY4LWltYWdlLWtwcXB4cHhzLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-20'
  where id = '66bf03e1-ad61-5766-9495-b426c31a1b2b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbG9jMjAxNzc4Mjg1NS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-19'
  where id = '1eedfd02-e1ad-5f17-8e33-551dd53418c4'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZsNDk0NjUzMDQ5OTctaW1hZ2Uta3VjZ2Z2aGouanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-18'
  where id = '6a69619c-2000-5f08-8f9f-bb98175bddc3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQxOS0zLTE3ODI1YS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-17'
  where id = '4221cfa2-8fe8-5ee5-b662-9a44a6c90613'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwzNzE0Mzk3ODUxMy1pbWFnZS1rcDUza2doNC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-16'
  where id = 'deef48bb-e4ed-56c6-be1e-5e0c020d3d1d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNDI4MjU1NDM3MDAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-15'
  where id = '63ead2cf-35fd-5d4d-b517-162c2e26365d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwxMDcxNjAzNzgyMy1pbWFnZS1rd2tmbWxwei5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-14'
  where id = 'a4debc91-08aa-5519-9402-dfbc06ee0143'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA2L2xvYzIwMTA3MTc0MzYtaW1hZ2VfMS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-13'
  where id = '9019e748-42c6-5283-8322-47e7606052f1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvd2s3MzYxNTU5OC1pbWFnZS1rcHFtNDV3di5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-12'
  where id = '679886ae-73d0-5739-802a-c82653456770'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2FpYzM4ODc2LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-11'
  where id = 'a236b4d8-2d28-574f-9327-97069a743f29'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbG9jMjAxNzc4ODAwNy1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-10'
  where id = 'a64a2611-6003-5cd9-9f61-3224f67ee73d'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyNjQyMDA3MDg4OC1pbWFnZS1rencyYzFkNi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-09'
  where id = '72c86139-95fb-5402-af39-5e676b579f43'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTIyNDc3OTA4NzQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-08'
  where id = 'be5903b0-ed1b-520d-97db-be140cf84020'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwzNzgxNDMwNTA4MS1pbWFnZS1rcDUza2RqOS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-07'
  where id = '256936a1-e1ae-5544-9311-12546904cec5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsMTYyNzIzNTYyNzUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-06'
  where id = '5cecd785-91e6-5e81-99a2-cd36cce20f44'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNDg2MzM4MDM0MDctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-05'
  where id = '77a9fc8c-3554-5ee5-a3ab-b32332c4123e'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2ZsMzQ2NTEyMTY3NjItaW1hZ2VfMS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-04'
  where id = '1d39eeb7-a4a1-5946-9a6d-8396e596d85a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg3Mjk0NjItaW1hZ2Uta3d2djI0ZTMuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-03'
  where id = 'd2a3bf13-d418-529b-add2-71c0ccd84246'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbG9jMjAxNzc4MzAzNi1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-02'
  where id = '1faaef0b-78c9-541e-9487-0a5de538636d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbG9jMjAxNzc4OTYzNy1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Education&key=migration-20260903-charitme-example-education-01'
  where id = 'c2d1b156-bfe9-5582-9d0a-9b0a54f5ac04'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJha3NoYXlhX3BhdHJhX2NoaWxkcmVuXzEwMjM3ODQtaW1hZ2Uta3oyZHo0NWkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-9-ad9f5ea4'
  where id = '146532a3-141e-4617-abb9-c450930234e1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw4MjUxMzI0NTA1LWltYWdlLWtwcW9neGJpLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-45-2f0192e2'
  where id = '20543cc0-2043-4896-b3aa-1f16e16ec053'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNDcwMzA0ODYwNDQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-63-b180c020'
  where id = '27764ab1-e3f6-4449-a372-71845db12402'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTAyNDEwNDc0NjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-81-efca287b'
  where id = 'd434b34b-640b-40f6-b8b3-b04872fccf5a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNTExMTM3OTU1MDYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-99-76baadf8'
  where id = 'c6067bfe-3189-4fe8-a949-e3b061c0abab'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0NjY1ODg2NTEyNS1pbWFnZS1renhqZjE1Yy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-135-fc3f2e96'
  where id = '98f857b4-2483-4152-ae48-989372fad688'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTI0NzQ5NjkzMzAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-153-70818233'
  where id = '56622fbb-ebc0-4e07-a35d-7ab7776accaf'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0NzU3NDQyNzA2MS1pbWFnZS1renhqZjE1bC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-171-b09d52a8'
  where id = 'b07d639e-b1de-4007-80e6-01272cf146c0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4Mjg4NzMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-189-9d704e99'
  where id = 'de000762-869d-4ac9-a8c0-84a312f2de44'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjQzNTAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-225-39b3c0b6'
  where id = '55aebf52-1f72-4901-bae6-4e7da758fae0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4NTE4NTQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-243-3ac9217c'
  where id = '2d9d4345-a0ed-45e7-b22d-3087ad9b4566'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNTExMTIwNzgyMjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-261-5cf5fec5'
  where id = '36f3625f-1477-46cf-8d8c-f1f491d5ec94'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDc0MjE0OTc3OTEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-279-b5265648'
  where id = '6e9fca95-c0f2-403f-a5e4-0ffa49156650'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjU4MDYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-315-26ecd208'
  where id = 'be1bd824-c00e-4fb7-bf87-80c5e9c3893a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjU4MDUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-333-08c981e0'
  where id = 'ef17da31-6ebd-4f95-8046-3c0f12b2489f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjQzNDItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-351-b7e076c5'
  where id = '010d396b-f28c-4889-ab76-330b5854a20d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjIxMTAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-369-04bce1d7'
  where id = '5c8f794f-9819-437f-999f-4a8bd90ae6aa'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyOTE4NzA4MDczMC1pbWFnZS1reWNqamcyMC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-405-d52a637c'
  where id = '065bb7c8-da63-4abd-9c1d-020501cce57b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2ZsODI1MTMyMzQyNS1pbWFnZS1rcHFvZ2dyOC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-423-edb0415b'
  where id = '6d60de0b-96b8-4a07-b624-3fa16ade1475'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTE2Mzc5MzA2MzctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-441-bc0d840f'
  where id = 'f49697aa-98b0-470a-9849-7ad65f12f586'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0NjgzOTE4ODA0NS1pbWFnZS1rdHdwOGIyeS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-459-90394054'
  where id = '94547b4f-3b82-4301-a0c2-6ccea7848695'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyNTQzMDAzODEyNy1pbWFnZS1rencyYnQ2Zy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Community&key=migration-20260903-campaign-495-e10cba94'
  where id = '682101e4-e40d-47c5-8bf2-8a521d11ce40'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L2xvYzIwMjE3NTc3MjItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-10-6a1bd5d9'
  where id = 'db669571-2c2f-40a4-86f9-7f4f8271fbcd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNTI1MTc2MzYyMDgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-64-67ce1180'
  where id = '5e33d0c9-ce21-4859-a4e4-b6689dfe55a7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2ZsNTE4NTQzNzY1NDQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-82-69610722'
  where id = '954b7395-0a34-4412-b374-280aa901abac'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDYyNTMwMDc2MDItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-100-be1f3b06'
  where id = '5bbfe0a4-18ea-46e3-9af6-2ae27b620373'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2ZsNTE4NTQzOTAzMDktaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-154-e9a4421b'
  where id = 'a291acdf-6163-4180-9972-7f4c03245894'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2pvYjY4Mi0yNDIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-172-57b5d265'
  where id = 'de88dd20-b49f-47cc-8ca4-ad0a50649311'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3Nta2trc2diMTg5MjYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-190-95805256'
  where id = '6bf66f9e-9907-4beb-8b89-f6001c7c34f9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnozNTU2MDUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-244-11f746fd'
  where id = '226cf9c4-fc72-49dc-911d-26405bcc3df9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4NDM5ODUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-262-e90d7c2b'
  where id = '81f3d373-18ef-4fd9-a4ae-d8e6c3875522'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL2dldHR5MTA2dzl3LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-280-064d9b8e'
  where id = '468f4126-d133-4e6f-b2e4-fb3c1a9c73c1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2pvYjY4Mi0yNDItbDF1N3BpbmcuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-334-1fcf7bfb'
  where id = '08feaede-c090-4ffb-a71d-4a61508d7087'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2pvYjY4Mi0yNDIteF8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-352-edcb80b3'
  where id = 'd9ff91f1-22fc-4c70-9539-bab6b676658a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2ZsNTE4NTQxMzE2ODgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-370-c4d6d93c'
  where id = '148b6d26-b491-4a5d-aece-26ce8042baa8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL2dldHR5MTA2d2FkLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-424-ec2a42cf'
  where id = '690d7fc7-c07a-4b86-8a36-2e8292c8b591'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2ZsNTE4NTQ3MTU5MTAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-442-2184fe92'
  where id = 'c6f07ed6-46e4-4a7f-be2f-2939bdeea6fd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXM3NDY0OC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Competition&key=migration-20260903-campaign-460-feff4933'
  where id = 'fa003b25-6fb9-44e7-bd7e-8e736ecd780b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2NsZTE5NTMtLTQ3NS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-11-49ea66a3'
  where id = '6db004b4-7113-43cb-9163-9634fcd169ab'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3BkMTMyLWZuZzEyMjY3MjItaW1hZ2UtYV8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-29-27adbb1d'
  where id = '9eac5196-7cee-4ec0-9d8b-48a15e8fe432'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDIyLTExL2ZuZzMzMDQ1MS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-65-fff4beea'
  where id = '6a137dd7-efd1-4733-8a00-ba96410563b2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2xyL2ZuZzI1NTIwNjYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-83-70608b5b'
  where id = '0d717f34-56f3-4b5e-92de-88e44d1091b1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEwLzY5Nl8yMDE4X2RpZ18wMV9vMi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-101-07140c27'
  where id = '506b4cbf-c097-47b6-8106-786af608ac27'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3BkMTMyLWZuZzE0NjM0ODUtaW1hZ2UtYV8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-119-b49e46bf'
  where id = 'd01faef0-735f-4b3b-a85c-3f9b346c17d8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0xMS9wZDEzMi1mbmcyNDE4OTUtaW1hZ2UtYV8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-155-b4c4b22b'
  where id = '43c187b2-5405-4be7-adc8-dcc06c670d6c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0xMS9wZDEzMi1mbmcyMzUyNTAtaW1hZ2UtYV8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-173-cfe1b5c7'
  where id = '2102feda-6c32-4c08-b4c3-d620f446866b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJqYW1lc193YXJkX3BhaW50aW5nX2FydC1pbWFnZS1reWJkZXRiNy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-191-e9aaeecb'
  where id = '564a28cc-6b37-4c8a-851b-b78039699011'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwzNTM1MjUxMTUwMC1pbWFnZS1rencxbzN5ay5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-209-09658939'
  where id = '35fc27ba-24ba-48d9-977f-6c8747268e65'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2xyL3VtZXN2a3NuZ28yODE3LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-245-bbb19547'
  where id = '6f4cfca5-f343-4aff-8a10-51a6bffbd11a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEwLzE5NDdwNzYtdGhlLXNreWxhcmsuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-263-9557021f'
  where id = '911fc2e4-b974-48fe-930f-842231acea6c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMjA0ODQ4LWltYWdlLWt3dnkycmNkLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-281-20cc658a'
  where id = '7c22680a-9d5a-4f46-947c-f630894655df'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA4L2lzMTYxNTEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-299-d3947bde'
  where id = '78353f1b-cd21-4400-a0e5-cfde4b9b0595'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTA2LzI1NjgwNjI5LXNtMzc1NmNiMjgtaW1hZ2UtbWNpdHJtMjIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-335-63739312'
  where id = '219d1280-a571-4d77-80b3-c93324a7f162'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX3dpbmRvd19jaHVyY2hfd2luZG93XzE5LWltYWdlLWt5YmJ4MnQ1LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-353-9b382a62'
  where id = 'de69f825-ea07-4e4c-a42d-f6906fe740c2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4OTczNTU4LWltYWdlLWt3dnVwcHY0LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-371-c2b839b7'
  where id = '549cd029-6b99-4c28-82e7-011a9ac34367'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3BkMTMyLWZuZzI1MDcxOC1pbWFnZS1hXzEuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-389-609dd7a8'
  where id = 'cacc1783-4003-4ca9-89d0-c7ce9e24db9d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0xMS9wZDEzMi1mbmcyMzY2ODQtaW1hZ2UtYV8xLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-425-63289958'
  where id = '1f501408-a996-4873-90bf-47a35c38a4fd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMTMzNzM0LWltYWdlLWt3dnkzdHg2LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-443-75899e7f'
  where id = '790ea7d7-422b-4008-a1d5-5126798a900d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA2L3BkbWlzYzEwLWZuZzE0MjU1NDctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-461-a61c1187'
  where id = 'a23011f4-d4fc-499b-b65a-6adbfe361153'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDIyLTExL2ZuZzIzNTI1MC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Creative&key=migration-20260903-campaign-479-164acc87'
  where id = 'c2f8de5a-17d6-47ae-8d12-16e945372aae'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L25zMTIyMDUtaW1hZ2Uta3d2eWRsODAuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-12-b5498da9'
  where id = '98fd0794-a799-452e-b8e8-267bb0a46571'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNDgxODY3NzI3MjctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-30-e9f949c5'
  where id = 'bfe7a1df-fb2a-4ce1-830f-e9bd5ffa1d1d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djamsyM3VwZHItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-84-f23bb02d'
  where id = '67a3716a-37f1-46e4-b37e-16c298d521e2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTEyNTgzMTc2MDgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-102-2140c51e'
  where id = 'd2094180-2ccd-47c1-a575-3fb9c7cd40d7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjczMC0xMDYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-120-1f174607'
  where id = 'd53412cc-cddc-4a9a-a0bd-c7b3ec1c2ae7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjczMC0xMDYtdi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-174-450e9913'
  where id = '6e754e89-0c5f-4a34-ba9f-e87e53d4ac00'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnoxMzAxMzEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-192-757115c3'
  where id = '3e882497-cc1e-420a-a39f-c92fb677904c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnoxMzAxMjgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-210-bc3720e4'
  where id = 'c4d887d4-fdac-4a4d-bc03-14250d0bdb6b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnoxMzAxMzYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-264-d4781815'
  where id = '86ba3a9e-7017-4079-b97f-37558d28a3a8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnoxMzAxMzAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-282-fe46651a'
  where id = '4ae5c04d-78ff-40ad-9f51-efa98d721483'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MzAxMzktaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-300-1eb74be8'
  where id = '6df13815-42a0-4115-8185-28225d868ddb'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzMTA0OC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-354-e5248aba'
  where id = '513568c4-b6c7-4c34-b064-2b6f2c7e51bc'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3VtZXN2a2duemczNTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-372-6217d139'
  where id = '2105e4e9-b656-429e-88c8-6c353365d287'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2VzL3dlYnNpdGUvMjAyMi0xMS9mbDQzMjIyODk3ODIxLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-390-2248efdf'
  where id = '352e55a3-4299-4433-acf8-ed8d671d20ec'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZsMjQ2MTU3NzEyOTktaW1hZ2Uta3UzdjlraXkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-444-f0e2c5b3'
  where id = '8a80629b-ed84-4bfb-9610-f25c13c1b93d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMyMTM3LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-462-23df8802'
  where id = 'b13f8905-dfcc-4b49-9bd2-e812acb87265'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MzI5NzAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Event&key=migration-20260903-campaign-480-26ab7d1c'
  where id = 'd89e02e2-1250-4234-a142-215fd91152da'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDgxODY3MTQxOTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-13-f75c4b8e'
  where id = 'ca2413ec-99a6-4a48-b0a1-37961804fa03'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfY3Jvc3NfcmVsaWdpb25fY2hyaXN0LWltYWdlLWt5YmUxNGxoLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-31-4529fd08'
  where id = '121f13d4-06c4-46c1-969f-608b30223d7f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJhcHNlX2FyY2hfY2h1cmNoX2ludGVyaW9yLWltYWdlLWt5YmVkbm8zLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-49-7e75ac85'
  where id = 'ea2e259e-3726-4ea2-bbdb-edff28a52183'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQyMDctMS00NzkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-85-d5aa51a7'
  where id = '08f9aa04-2e2b-4afc-8c1f-834e228bc390'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL2dldHR5MTA5bXc5LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-103-fb98b785'
  where id = '166921d1-6834-42f2-bc2d-979e250d290a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfY2F0aGVkcmFsX21vbnRyZWFsXzE0NzAxNjctaW1hZ2Uta3liZTIyOXUuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-121-5994738a'
  where id = 'd864c382-4929-490d-9d8b-967fd5e5b317'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L3Vwd2s2MTczNDQxNy13aWtpbWVkaWEtaW1hZ2Uta293cjB3NXkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-139-3a4808d5'
  where id = '63da808b-64c9-4599-b6a6-3993307b84f1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxOTE1MjMxLXdpa2ltZWRpYS1pbWFnZS1rb3dlcDlyay5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-175-fd841db7'
  where id = '207a3264-78ac-43cf-9d8b-4b51392bc982'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJuYXZlX2ludGVyaW9yX2JlbmNoZXNfYWx0YXItaW1hZ2Uta3liZDQxZzAuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-193-12a2e466'
  where id = '85941332-cd88-49d1-85f9-97089251f9de'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfYnVpbGRpbmdfYWx0YXJfd2luZG93LWltYWdlLWt5YmUxdTc2LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-211-c672f7f4'
  where id = '6957740d-6def-4b79-9833-e6bc8c34d181'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJyZXlramF2aWtfY2h1cmNoX2hhbGxncl9jM18zLWltYWdlLWt5YmN1b2Y0LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-229-c7ac0bec'
  where id = '5f02ba00-0256-438c-bd7b-94023b0f7e91'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyaWNlbGFuZF9idWRha2lya2phX2NodXJjaF8yNzA0MTEtaW1hZ2Uta3liZGc4N2EuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-265-012c8880'
  where id = '50c33c04-31b3-41f1-8a74-1979c0bab12c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZybGluY29sbl9jYXRoZWRyYWxfYWx0YXJfNDYwODc5LWltYWdlLWt5YmI1Nzh4LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-283-94d6f4ae'
  where id = '7fcbf976-3dd4-4956-80be-01da7874a261'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY3lwcnVzX2xpb3BldHJpX2NodXJjaF9vcnRob2RveC1pbWFnZS1reWJicWx4Yi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-301-e27d0c41'
  where id = '438ab8ac-4158-4d09-8c7e-c7bee383860b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfYmVuY2hlc19yb3dzX2JlbmNoZXMtaW1hZ2Uta3liZTI4dDQuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-319-66567a8f'
  where id = 'b6f9579c-1598-4a42-9d51-f424ae7d2a69'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2hyaXN0bWFzX2NodXJjaF9jaHVyY2hfYXQtaW1hZ2Uta3liYnVwdTMuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-355-91985353'
  where id = '91ca004d-feed-4465-83c2-51cab65d147c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYyMTM5MzM1LXdpa2ltZWRpYS1pbWFnZS1rb3ducHJ4Zi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-373-2dd21004'
  where id = '247d7e52-1de4-4a83-9b7e-5e1ed13c1a1c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX2RvbWVfYnVpbGRpbmdfNzAzMzU2LWltYWdlLWt5YmJ4MnlkLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-391-e69784e5'
  where id = '722fef97-90ac-443c-b740-dca760b123ec'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJvcmdhbl9pbnN0cnVtZW50X2NodXJjaF9tdXNpY18xLWltYWdlLWt5YmQ0MnZpLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-409-9f992abd'
  where id = 'd79fac01-f055-44b6-8be1-050c38293aba'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxNDE1OTI1LWltYWdlLWt3dnh4ZGN0LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-445-3df16f1f'
  where id = '2a3fbbf9-169e-4896-b9bd-68090e114234'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4ODg4OTcxLWltYWdlLWt3dnV3bWpmLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-463-ba1d8883'
  where id = '95f44e19-76bc-483e-8e11-ef5b56f85e4a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZycnVzc2lhX2Jvcm92c2tfb2xkX3Rvd25fMi1pbWFnZS1reWJhc2JwZC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-481-521b5df8'
  where id = '18e0c655-8d41-477b-be0b-133b38708ed0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZmxlbnNidXJnX3N0X2pvaGFubmlzX2NodXJjaC1pbWFnZS1reWJia3I5Yy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-campaign-499-d6bf3ddf'
  where id = 'cf58547c-e93a-4256-870f-263c6f7db882'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfdmF1bHRzX2ZhaXRoX3JlbGlnaW9uLWltYWdlLWt5YmR4djIzLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-50'
  where id = '314ed58d-e924-5f6c-bc0e-5f6e9b57cc83'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZ3VpbGRmb3JkX2NhdGhlZHJhbF9zdXJyZXlfY2h1cmNoXzAtaW1hZ2Uta3liYmR2cDYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-49'
  where id = 'b3ac2574-6a71-5187-a1de-a9b83c349c43'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L2xvYzIwMjE3NTYyMjYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-48'
  where id = '09a902c4-b1bb-507c-a9d6-20f286ebf74e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2pvYjY3MS0xNTUtdi1sMWRhOHkzdi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-47'
  where id = '45e8a862-8e2c-5fd0-af39-a95190c54150'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX2NhdGhvbGljX3JlbF9yZWxpZ2lvdXMtaW1hZ2Uta3liYnhibzMuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-46'
  where id = 'd073db11-7104-5f63-917e-c37191481dc9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2ZydGVtcGxlX2NodXJjaF93aW5kb3dfbW9udW1lbnQtaW1hZ2Uta3liY2pnZzYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-45'
  where id = 'd4603b45-5d40-53ad-8131-cd0c82485f03'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfendpZWZhbHRlbl9iYXJvcXVlX2ZhaXRoXzktaW1hZ2Uta3liZHk1MmguanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-44'
  where id = '65677a89-1b5e-5486-a7cb-470e1ce6f370'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyNjgxODA3NjEwMS1pbWFnZS1rdHdwYjBjZi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-43'
  where id = '94739ff4-7dd3-5cc3-a9d5-a6e68a87a023'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyODg2NzIyMDQ3Ny1pbWFnZS1reWNqaHd3dS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-42'
  where id = '6a7202f6-e501-5c26-9ed1-ab2aed3819dc'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJtb25hc3RlcnlfY2h1cmNoX3Bld19wZW4taW1hZ2Uta3liZDd0anouanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-41'
  where id = 'a97914f0-6ecc-5906-8a64-7d7afb8ea56d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfbW9uYXN0ZXJ5X2dhbmdfcGVuLWltYWdlLWt5YmR5NmhhLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-40'
  where id = 'df27bc9d-696f-5fd2-adf7-c06b089e59d4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyNTA0NTkyOTMzMi1pbWFnZS1rdHdwYTRyMi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-39'
  where id = '5a8d1d43-431d-599d-bb52-ea0ba69df16f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQyMDctMS00NDZfMS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-38'
  where id = '6a62ebb6-464b-5f38-a33c-0af97d92d8f1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMyNjk1NC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-37'
  where id = 'b55cca3c-ea33-5681-bc43-c8148c8ac23e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYyMTMzOTMwLXdpa2ltZWRpYS1pbWFnZS1rb3dpeXNhYi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-36'
  where id = 'd7d3b567-362b-5fb0-b405-52c7628b0197'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYyMTI5MzgzLXdpa2ltZWRpYS1pbWFnZS1rb3dubDZkMS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-35'
  where id = 'f13d27da-0a2f-51bd-bf4d-35bb4fb90c47'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZycGFyaXNfY2h1cmNoX2NhdGhlZHJhbF9mcmFuY2UtaW1hZ2Uta3liYXhyNXouanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-34'
  where id = 'bc40a701-ed3e-5797-85ac-8c9fce565e6c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2xyL2ZsNDc3NDM3NzE5ODItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-33'
  where id = 'e5e9b92b-c187-5f9f-8460-406edc947641'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L21ldDM0NDAxNS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-32'
  where id = '8b25f6a6-bdef-57f2-a7e8-9feb06f672fe'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA2L3Vwd2s2MTg5NjI1NC13aWtpbWVkaWEtaW1hZ2Uta293cDI3cmYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-31'
  where id = '27321c9c-474c-587c-a9ab-3b75eead00aa'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyNjM2NjI5NjQ2MS1pbWFnZS1rdHdwYmZyai5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-30'
  where id = '4de3c907-e2e9-5004-854e-afda3dc31e76'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTYzNjM2MC1pbWFnZS1rd3Z2azFsMi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-29'
  where id = '81f2b5eb-f924-55c6-81c1-fbb930c8e569'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJlZXJhbmdlcGV4ZWxzMDA4NzQtaW1hZ2Uta3d2eWh1OG0uanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-28'
  where id = '6b15146c-3769-523a-a0a5-77aa35643b2f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2Zyc3dpdHplcmxhbmRfY2h1cmNoX2RlY29yXzc3MTAxLWltYWdlLWt5YmFrbHVtLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-27'
  where id = '6fbbd8e6-1e8c-5f8b-8ad9-089bdddce1d3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNzA0OS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-26'
  where id = '7ceaa42f-04d3-5c6a-9f44-48232baf2d0f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX2JhdmFyaWFfZ2VybWFueV9sYW5kc2NhcGUtaW1hZ2Uta3liYnVpcnYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-25'
  where id = 'eaa2c8a7-a17a-5e52-979e-029d2a67e509'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMyMDczLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-24'
  where id = '51d67449-612a-59b1-ab08-7369939aad7d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX2J1aWxkaW5nX2FyY2hpdGVjdHVyZV8xNDM3MjAzLWltYWdlLWt5YmJ2aXc5LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-23'
  where id = '6d7273b7-3b64-5314-b170-386de625d5f3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX2JsdWVfc2t5X3NreS1pbWFnZS1reWJid2RvYS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-22'
  where id = '9d66be2f-2327-5c7c-a84c-00916f69ccf5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwzMTMxMzQ3NDAwOC1pbWFnZS1rdHdwOHY0Ni5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-21'
  where id = '5e5de2b9-2166-5fdd-9126-ef8b384a2c5c'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvam9iNjcxLTExNy1wLWwxZGE4NzU4LnBuZw.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-20'
  where id = 'b1b50e88-6afe-56a6-ba3b-e8f7424c87a4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA2L2ZsNTExNzAwMjYwNTAtaW1hZ2Uta3R3cGhucnYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-19'
  where id = 'f11c9f7c-814b-5afb-96dc-e5deffddaadf'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJhbHRhcl9ndWlsZGZvcmRfY2F0aGVkcmFsX3N1cnJleV8wLWltYWdlLWt5YmVlOXBjLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-18'
  where id = '8aa996a8-79dc-5e9e-9977-de4c9c52991c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX2dvbGRlbl9kb21lX3J1c3NpYV82LWltYWdlLWt5YmJ3czl0LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-17'
  where id = 'de3cea41-147a-5b92-b277-1eb3f6593db1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2h1cmNoX3dvb2Rlbl9jaGFwZWxfY3Vwb2xhXzAtaW1hZ2Uta3liYnczZmEuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-16'
  where id = '39291236-4e77-5bd1-8685-258dd661a003'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbG9jMjAxNzc4OTAwNS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-15'
  where id = '787fa71c-aded-57f4-be87-414240d79348'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L2xvYzIwMjA3MjIxMzItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-14'
  where id = '34926830-0ab3-5599-9974-ac9e9dd4be78'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3Nta2trc2diNjU4MC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-13'
  where id = '9fdbd159-3f11-5a09-9afd-08f917c0bcf9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvZnJqZXN1c19jaHJpc3Rfc2FjcmVfY29ldXItaW1hZ2Uta3liYmFwd3EuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-12'
  where id = '3d8afcbb-63b8-5e5d-9986-824c49784a56'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMxNDQ4NC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-11'
  where id = '71627c04-ac85-5bac-8b9d-a6f76fac3770'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzMzk0Ny1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-10'
  where id = '202d60ee-70ce-511e-b7f1-085996bc94cc'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHJpc3RpYW5fY2h1cmNoX2FsdGFycGllY2VfY2h1cmNoLWltYWdlLWt5YmUyb2ZiLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-09'
  where id = '31caeda5-cf79-5f3d-8a1e-6ca9989167ee'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L3Vwd2s2MTczNDYzNS13aWtpbWVkaWEtaW1hZ2Uta293cXVhNGIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-08'
  where id = '70c753c1-8248-57b7-b71c-f66f15f76c00'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJjaHVyY2hfb2xkX2J1aWxkaW5nX3RyYXZlbC1pbWFnZS1reWJkejBmYi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-07'
  where id = '664bcf45-4d50-590f-9511-d27eb22a739e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZG9tZV9jaHVyY2hfZG9tZV9wYWludGVkLWltYWdlLWt5YmJybWMyLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-06'
  where id = '9f5f4dd5-e9cc-5683-be0d-75f8e0fdca01'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyNDIyNTYwNTEzNS1pbWFnZS1rdHdwYnUwZy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-05'
  where id = 'fc8f7df8-aec2-5d31-9cc5-b6e92818065a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2Zyd2l0endvcnRfY2h1cmNoX3N0X21hcnktaW1hZ2Uta3liY2N4ZDUuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-04'
  where id = 'e15956af-627e-5bb6-b2c2-07969fac8856'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJzdF9oZWxlbl9zdG9uZV9nYXRlXzAtaW1hZ2Uta3liY291cDguanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-03'
  where id = '9d88f4a1-ac37-5108-a6dc-ffff79759ff7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJpdGFseV9yb21lXzEzMTg1NDAtaW1hZ2Uta3liZGYweGguanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-02'
  where id = '79e08ce8-7520-5697-b67a-28cdc8fbe659'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2hhcGVsX2NodXJjaF9jcnV6X3NreS1pbWFnZS1reWJidXJrNS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Faith&key=migration-20260903-charitme-example-faith-belief-01'
  where id = 'f6feb2ba-5d80-51c1-97c9-5ea57844f0e7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4MjA1ODgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-14-8cb989b8'
  where id = 'a26936df-828f-49c2-96b9-e3e0e9a235e6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTEzNTk4NDQ4OTQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-32-4f1fb79b'
  where id = '28f9188a-3085-49ba-b278-0a3b825414a3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA0L2pvYjk3MC1lbGVtZW50LTE5OC1sZzduY3NuMy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-50-46bd41f1'
  where id = '5d10b10c-31fa-4532-ada4-f1a3c497ee6f'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA0L2pvYjk3MC1lbGVtZW50LTE5OC5wbmc.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-104-e5c27da4'
  where id = '29658052-e706-492a-b195-a51b6d0c3b53'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L21ldDM5NTk4NC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-122-639083b7'
  where id = 'df5f3bf5-f53e-461e-9ac2-3ad70a721ebc'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djYXViczR6ZnEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-140-68a2d3a0'
  where id = '24b8706f-5ee2-4413-b8fd-1d6348734d80'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTA2LzI1NjgwNjI5LXNtMThmMjRiZGEtaW1hZ2UtbWNpdmJqZXouanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-194-65639c30'
  where id = '1f32c64d-5868-4e32-83dc-e0d93422349c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA0L25nYTUxOTk0LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-212-a61f0060'
  where id = 'b2ec4537-c007-4b4a-94a1-5db635dbee3b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djZW14Z3lrbmItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-230-fba29882'
  where id = '2f429425-62b8-41d3-9168-7e1efef34161'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4NDM4MjUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-284-7dc0b2d9'
  where id = '5ddee930-d176-4213-b828-62fc15730aa4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvc2s5OTg1LWltYWdlLWt3eW5ndnVyLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-302-948d95e0'
  where id = 'aa50b5c7-354a-4741-8b18-887879597b4e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvZmlsZXMvd2Vic2l0ZS8yMDIzLTAzL2NsYXJrMTk2MC0tMjEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-320-eef98ca3'
  where id = 'ff9f8410-f94d-4f39-87f7-eb7f540a1e22'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L21ldDcwNDg3OC1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-374-3c342158'
  where id = '7610dbc6-dbe3-4ea9-be93-451f6f6885f5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNTE0OS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-392-66f97c55'
  where id = 'bf068a40-f639-4ae2-822d-b717973752ea'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL21vbnoxMjYxMTk0LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-410-5e15e869'
  where id = 'e1d08c43-1894-4059-b3c1-57f9493a764d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA0L25nYTU5NDAxLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-464-3a739e67'
  where id = 'dd32d98c-6cf2-4e23-ba9f-889e06f9b590'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL2dldHR5MTA3ODI0LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-482-305e1a0d'
  where id = '08a9c111-0a93-4c37-9d78-54e018eacdaf'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L21ldDM0MzEzNy1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Family&key=migration-20260903-campaign-500-d8be4a81'
  where id = 'd1c56628-3c81-45fb-a039-f435eaa6ab73'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL2dldHR5MTA3ODI1LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-15-65b108ed'
  where id = 'fa7e49fb-ec76-4e56-919b-fd5f8c501d3c'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjcyMy0xNzYtcC5wbmc.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-33-e10ded17'
  where id = '5b68f383-8ab9-4fd7-9f7e-180df3b3d11c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2ZsNTIxOTAzOTc1NDAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-51-4f15e334'
  where id = 'c61b6b8f-831b-4bba-bb2e-d8203a033c0f'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvam9iNjgwLTE5LXAtbDFkYnQ3azcucG5n.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-69-b2fb6618'
  where id = 'ee69033f-329c-4304-9e03-5944e74592e2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2ZsNTIyODE0MDY0MzMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-105-eb5b2c79'
  where id = '7ac3faa6-7eff-4b61-889a-0154afe6a9a1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJmb290YmFsbF9zdGFkaXVtX2hvdF9haXItaW1hZ2Uta3liZG43OXIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-123-b1ad88b8'
  where id = '1cc9bf83-2a06-4d06-8411-c355efb3151f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3Vwd2s2MjIxMDQ5MC13aWtpbWVkaWEtaW1hZ2Uta293czNlaHYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-141-89393dc2'
  where id = '3da20de9-4136-4eb8-9154-be171958f3d7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2FwZV90b3duX3NvdXRoX2FmcmljYV8xNi1pbWFnZS1reWJjMHk1Zi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-159-fb50dc7f'
  where id = '444c4ecf-eae1-4ce8-8d55-717db0be5a8d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTEyL2ZsNTI0MzgxMzA5ODktaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-195-4506c26a'
  where id = '3ca81862-bef3-4fca-85ec-d8353f3ebea2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZybmF0aW9uYWxfc3RhZGl1bV9mb290YmFsbF9icmFzaWxpYV8wLWltYWdlLWt5YmF6eGFiLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-213-56275168'
  where id = 'b91769c4-8e7b-4052-a7dc-085c238f2b0a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZycGFyYWdsaWRpbmdfc3RhcnRfbW91bnRhaW5fd29ybGQtaW1hZ2Uta3liZDFmcHIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-231-e21e4d74'
  where id = 'e6d78037-9ef6-451a-ba1b-bde9ba7ea923'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA4L3BkbWlzYzJiYXRjaDItcGR5YWxlYnJpdGlzaGFydDAwMjg1LWltYWdlXzEuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-249-d9cee435'
  where id = '74d1d12b-f3e0-460c-b2ee-69be9474d8c7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvcHg1NDIzOTYtaW1hZ2Uta3d2dmY1N3MuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-285-87c17f3d'
  where id = '09c771bd-810a-432b-a66d-317f6faa35e7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2xyL3NtaXRoc25zYWFtMjAwMjc5ODEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-303-7265364e'
  where id = '8a8e4105-0d53-4536-b1cc-5f5b395318a6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgzMTkyOS1pbWFnZS1rd3Z4bnV5NC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-321-6ac65f09'
  where id = '31f67427-f5a2-4518-a347-c8cbc68ffe70'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZWVyYW5nZXBleGVsczA2NzU4LWltYWdlLWt3dngwbXNtLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-339-1055318b'
  where id = 'd7afc87d-eb28-4aaf-849d-3a457e8bec04'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvam9iNjcwLTAwNDAtcC1sMWJqMDJqaC5wbmc.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-375-0091e3e3'
  where id = '32b30925-1ab9-4989-9424-7f811cdc8aa3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZHRtX3Nwb3J0X2F1dG9fNTkwNzc2LWltYWdlLWt5YmJudjBsLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-393-405f725c'
  where id = 'dfe89e1a-57be-4c3a-b35d-12a587563a4e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTI1MTQ1Mi1pbWFnZS1rejJlM2drei5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-411-d844cc4a'
  where id = '7728b621-de8f-44b9-9db0-e9f4113a344d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2pvYjY3NC0wODUuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-429-d02b15d2'
  where id = '2a0059ca-2a3d-4cd0-b620-55cb2f333d28'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTE0MTQxNzQ2NzMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-465-6e8c8b0a'
  where id = 'bc85b5b0-acad-4b66-903d-497ccce19a7d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA3L2pvYjk0OS0xMjAtbDYzYjlsejIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Sports&key=migration-20260903-campaign-483-cacaead6'
  where id = '6ec8b304-7068-46fd-aef9-2bd974abdd5e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0OTcxNjI1NzA5My1pbWFnZS1reWNpcmw2OS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-24-5cc5db7b'
  where id = 'be88cadb-413d-49d6-9b0e-a3ab89703f35'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJkb2Jlcm1hbl9kb2dfcGV0X2JhbGwtaW1hZ2Uta3liZHV1dTAuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-42-cb45c2b1'
  where id = 'fd034b55-a05a-46d1-a4e1-d5c0655869c9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJib3JkZWF1eF9kb2dfZG9ndWVfbWFzdGlmZnNfMS1pbWFnZS1reWJlOG1veS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-60-5aedb40d'
  where id = 'eb44bf11-676e-4f10-b0cc-457ce05c37d6'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azU4ODMxNzk0LXdpa2ltZWRpYS1pbWFnZS1rb3dhdG0xdS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-114-917a9fbe'
  where id = 'ae5f9337-625c-44f4-8733-35dd80c375df'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODk4NjkwLXdpa2ltZWRpYS1pbWFnZS1rb3dveW13bC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-132-d5e52558'
  where id = '46c09dba-2dbf-4de6-9930-517556c6f8ef'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJkb2dfcGxheWluZ19kb2dfcGV0LWltYWdlLWt5YmR0OWtwLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-150-c2d64c58'
  where id = '8347c5d5-5567-4eae-8e04-ecd05a6b7cea'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODU1NjI5LXdpa2ltZWRpYS1pbWFnZS1rb3dkMGxsai5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-204-997a3fdc'
  where id = '559ccfa6-8c17-4041-aced-3672cccff5cb'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2ZyZnVubnlfZG9nc19hbmltYWxzX2Z1bm55LWltYWdlLWt5YmRrZ2E4LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-222-0e75da5d'
  where id = '800faa07-b7cb-4152-ae18-72e2451046e1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2ZsNTAzNDkyMzkyNTgtaW1hZ2Uta3R3bW5wOHYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-240-703a87b7'
  where id = '32e60496-bcf0-4a99-88cd-6163f8937e59'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMjAxMzc0LWltYWdlLWt3dnc3aGo0LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-294-34ada044'
  where id = '98b71a47-cac0-4c69-bf72-e4bd166ecd8a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxNTgzNjIxLWltYWdlLWt3dnZxaWh1LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-312-4d583592'
  where id = 'd8a6464c-9917-479c-bccb-b0702093e58b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg4NjMzOTktaW1hZ2Uta3d2eGVieHouanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-330-f07c9dd1'
  where id = '9e180ad8-df77-48cd-a623-77766641f1a7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3Nta2trc2diMTgwMTUtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-384-aaab2596'
  where id = '2f1a1c31-b9fe-4d04-affa-6fad9343c2e4'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3Nta2trc2diMTIzMzYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-402-2c7ff4f7'
  where id = 'df7831ec-9bc1-451a-a817-ce87b7992505'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvcGQ0My0wNjA0LTI0OC1uYW0uanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-420-4d4439ac'
  where id = '8efde0b6-16da-4c93-8349-f93559b965b0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA3L3BkbWlzYzE0LXdrMjIxMDY5MzktaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-474-534a8b57'
  where id = '3ac3aa2f-084a-483c-a56a-19db029dbf51'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg3NzA5OTEtaW1hZ2Uta3d2eGZza2cuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Animal&key=migration-20260903-campaign-492-2315465c'
  where id = '96badce3-35f9-4955-a863-0d8a8feca485'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYyMTc0OTk0LXdpa2ltZWRpYS1pbWFnZS1rb3dmenR3dy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-25-a11a8bc5'
  where id = '71afa4fa-f9d1-48ca-bcef-944a2b5dcbfc'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxNjUyNjA4LXdpa2ltZWRpYS1pbWFnZS1rb3dyaHNkNC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-43-220b648a'
  where id = '38e1fe29-b6de-4c1c-9bb8-8cac80bff49a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azU4Nzk0MDkwLXdpa2ltZWRpYS1pbWFnZS1rb3dtOXEzMi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-61-d6db02d3'
  where id = '04eb4b62-b269-4fe1-8761-7751ac550061'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2ZyZm9yZXN0X25hdHVyZV9sYW5kc2NhcGVfdHJlZXNfMi1pbWFnZS1reWJka3kxcy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-79-874afd17'
  where id = 'cf6896d6-522d-45e0-93a8-bf2c448542c8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvc3YyMDc2MjQtaW1hZ2Uta3d2dWU2NDkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-115-67f9e5c7'
  where id = '6c9a36ec-edc1-4b7a-a5f4-7a086f141132'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L3drOTEzMTYwMjQtaW1hZ2Uta3A2Ym9jenEuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-133-848d7f04'
  where id = '57c464e9-51b8-4ee9-a4d3-7c3eb4c062f0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI2LTAxL3BkYXJ0MjAyNi00MDItbWt4aTJmaWIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-151-e617ef13'
  where id = 'ea7eeb5d-5f37-4aa8-b5cf-77c2fb3a5496'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvYTAxMC1tYXJrdXNzLTA4NjQuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-169-e19ef335'
  where id = 'e4f9de91-d087-4ab2-b770-eb7a0ebadac1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODIzNTg4LXdpa2ltZWRpYS1pbWFnZS1rb3did3B5bS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-205-e292e34d'
  where id = 'c29d76c8-277f-4d7f-936d-8a2cd4843d6f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJhd2F5X3BhdGhfZm9yZXN0X2hpa2luZ18yLWltYWdlLWt5YmU5andqLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-223-f9ddb654'
  where id = 'fffa1e15-6829-4dbc-b506-a41287f5ca8d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azU4ODAzMDU5LXdpa2ltZWRpYS1pbWFnZS1rb3dtY2hvcy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-241-3861db22'
  where id = '36e9134c-3499-427d-9932-00b7fa8bcc89'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjczMC0wODMtcC5wbmc.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-259-5dede646'
  where id = '62eddef0-1ee8-4b9e-8edd-d2e864101924'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwxNzc3NDIxNDI1My1pbWFnZS1rcHdhMTd3aS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-295-8d5c2334'
  where id = 'c5a436a2-3c2a-44e1-b4e7-74dbd40032a5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMxMjQwNi1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-313-d59349c5'
  where id = 'c7126267-912e-43d6-9572-664f926603e5'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvd2s4MjQ0NjAwMi1pbWFnZS1rcDZjYTZrei5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-331-8affaae8'
  where id = '96eb84b3-1211-40ba-8772-43dba725a4c2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L3Vwd2s2MjA2NzM0My13aWtpbWVkaWEtaW1hZ2Uta293bzdoNWIuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-349-1b7f2075'
  where id = 'f8d1cca7-bf34-4188-b361-f2ded6fe6d60'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxNjU3MDcxLXdpa2ltZWRpYS1pbWFnZS1rb3diM24zOS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-385-fd3756d6'
  where id = '92d217d7-23b9-476d-9935-a4085bc928e0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTI4NS1pbWFnZS1rd3Z3M2pmeS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-403-2ebf5576'
  where id = 'f44014f1-c4ab-4d7b-bebb-8d6f25982d76'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTIxOTAxMS1pbWFnZS1rd3Z5MzZhZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-421-d51cf0b2'
  where id = 'a0683413-007f-4aae-a08a-7784b11ffd88'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNTI3Njg2ODAxMzMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-439-b4d8462e'
  where id = 'cdc38a32-e458-47de-92fb-247df08b6a4c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL3Nta2ttc3NwNzg2LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-475-059408e4'
  where id = '992ae0ad-f93e-4486-82cb-7c0c2766e1a0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw1MTEzOTU1MzY1Mi1pbWFnZS1reWJlaGdwYy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Environment&key=migration-20260903-campaign-493-682a26a0'
  where id = 'a2c24d58-2d7a-4708-901f-86912fed5992'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxNzkxMDU3LXdpa2ltZWRpYS1pbWFnZS1rb3didWVrOC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-34-05dff02a'
  where id = '63a434d6-fc9f-452c-86b7-401c82ab9312'::uuid and cover_image_url = 'https://images.rawpixel.com/image_png_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvam9iNjc4LTA0Mi1wLWwxNjRwdHV1LnBuZw.png';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-52-d55dd56f'
  where id = '7ae6371e-7c7d-4915-854c-a78b2e0583ce'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvam9iNjc4LTA0Mi14LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-70-f32539f1'
  where id = '547c3d12-127c-4fbd-b7c6-996984897277'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2Zyc3VpdGNhc2VfdHJpcF9wdXJzZV9icmFuZG9uLWltYWdlLWt5YmFsbWxrLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-124-34cee429'
  where id = '290482dc-c898-4cf4-9075-3a8f1eedf935'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA5L2xyL2xvYzIwMTI2NDk2NzMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-142-11a69557'
  where id = 'b093fa84-5814-411d-878e-a75995a68ad9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvam9iNjc4LTA0Mi1sMTY0cHEwNC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-160-a042b0a1'
  where id = '78b1e2ea-0ae9-4a5f-91e0-5d21e5de9169'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2xyL2xvYzIwMTQ2MzU0NzYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-214-ce431a74'
  where id = '797fb98f-fbe5-4a2e-8cfe-ae98cfcd3fd3'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTA0L2RpZ2l0YWxjd2NvbW1vbndlYWx0aDByOTZmbjQ5dy1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-232-72686460'
  where id = '5a25b077-1679-47c6-abaa-72f9b84bfbcf'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXM0MTIxLWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-250-75ad7217'
  where id = 'e9860b11-c5a6-4268-b956-4a54a8156203'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZydHJhdmVsY2FyZF90aWNrZXRfbG9uZG9uXzQyOTI3Ny1pbWFnZS1rejJlN2sxNy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-304-740970a9'
  where id = '40d74b08-dbc7-4b79-b5db-07e1ab6c3ca1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg3MTQ1NTQtaW1hZ2Uta3d2eGk5bXYuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-322-e5d874ff'
  where id = '23fcd1be-ce0c-4410-9c82-0cfb139fff98'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyaGVhZHBob25lc19lYXJwaG9uZXNfcGhvdG9fY2FtZXJhLWltYWdlLWt5YmJkZGZjLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-340-93a241ab'
  where id = '120d5778-9899-4ac6-8cd6-41730a1bb0d0'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJ0YWtpbmdfcmVzdC1pbWFnZS1reWJja3pmYy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-394-8598eb20'
  where id = 'd0345042-dfc4-4252-8c80-aa1b8db7f53c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJhaXJwb3J0X3RyYXZlbGVyc19wZXJzb25zX2J1c2luZXNzLWltYWdlLWt6MmR4dXY0LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-412-5f193032'
  where id = '182d10f2-8c4c-453f-9169-4b18dd1de9b1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTg3MTg3MTItaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-430-adf95a09'
  where id = 'b0ca2809-84cd-45fd-b625-54bf88485192'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTg3MTk4ODEtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Travel&key=migration-20260903-campaign-484-43cf99ff'
  where id = '9b1ade81-b5eb-48be-8355-8e911e263191'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvam9iNjg0LTE1Ny12LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-35-70c61715'
  where id = '0eb6dbb4-4f34-496f-8349-87c6e791ac81'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAzL2ZsNDg0OTQzMTE4NTYtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-53-871fb3c5'
  where id = '3855dd97-39f5-407a-a54f-e793dfc9f48f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTA4MjE5MTU3MzgtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-71-cf924fdb'
  where id = '05796377-6f76-4052-a684-a7b582ef6b17'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTE5MDIxNzIzMTMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-89-b03e383e'
  where id = '53008384-7488-4a20-8017-397b576b1f8e'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNzYzNS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-125-39a5963e'
  where id = '687cced9-07fa-459b-ba4f-29f914303fbb'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMyOTM4NS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-143-10a946b6'
  where id = 'fafeb138-4fcd-4145-a0c7-8fb8c0e9a46d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMyMDk2OS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-161-44f6b441'
  where id = 'fbf119b3-196b-486a-a33c-e8b3b1058b75'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZsNTA2OTYwNTE4MzctaW1hZ2Uta3U3ejN0dDQuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-179-146b21dc'
  where id = '39ee8bba-539f-471a-95c1-730d4ac1b87c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzNDc2My1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-215-ed55d496'
  where id = '68643860-ffc9-48da-a0f7-43a8657194fd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbG9jMjAyMDczNzQ0NS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-233-0777a760'
  where id = '5aa96481-c953-4b1b-ba90-5074e3716495'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXMzMTU5OS1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-251-b9de380e'
  where id = 'def36658-e97a-4db0-83ff-a0f569ab6447'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTAxL3ljYmF0bXM0MTkxNi1pbWFnZS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-269-f64fb172'
  where id = 'dcddf260-9963-49f0-b8f6-f28d6dbfeaf2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2xvYzIwMTY4NTI3NjAtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-305-8b9bc57e'
  where id = '42fbbc97-a490-4abb-bf96-ba7af553f826'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2xyL2ZsMzY5MDczMzI1NzQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-323-6ba0bb6f'
  where id = 'd47f97f0-320d-46fe-a6c8-d2a67c032f9f'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZsNTA2OTYwNTIwMDItaW1hZ2Uta3U3ejNzOXouanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-341-03c79b9b'
  where id = 'c5663088-8f35-4ca4-a040-95e8c46f3313'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTA1OTc4MzUzOTMtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-359-ac98c2dd'
  where id = 'a2b246ec-f226-4168-9055-e05c966cbc8c'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2xyL2ZsMzY5MDczNDQ2NjQtaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-395-4e6ae3e5'
  where id = '64816018-b91a-4cb5-af5c-814bc8d4f49c'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2ZsNDg3NjI3MzkyMzItcHVibGljLWltYWdlLWtvd3M4dmxsLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-413-8ceb33f9'
  where id = '71582b1a-98f0-4e31-b28c-82332e216723'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw1MDY5NTIyMzg1OC1pbWFnZS1rdTd6M3I0Ni5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-431-f319344d'
  where id = '54bb25f8-7fa7-4bc0-96ac-c35f6b540773'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L2ZsMjc2NzU5NDQ5MzMtaW1hZ2Uta3Awc2J3MncuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-449-6f5ae41c'
  where id = 'f01fcbb7-f176-4b58-9a0a-8c65ab63e17e'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0OTE3Nzk5MjczMy1pbWFnZS1rdWRpM2o3Yy1remVtZW5vdy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Volunteer&key=migration-20260903-campaign-485-2bd2601b'
  where id = 'f1422fe2-c5da-4704-9006-be3f33715be9'::uuid and cover_image_url = 'https://images.rawpixel.com/image_1300/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcGQzNi0yLWtzYy0yMDA5LTUyODVfMS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-44-87ae414a'
  where id = 'ee0029cb-55fe-4e06-bd12-40cd279909e8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2lzMTY3MTMtaW1hZ2Uta3d2d3RpamkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-62-afeb5a0d'
  where id = '643a736f-e5bf-4886-88ad-48f1e144c6e9'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2Zyc2hvcHBpbmdfY2FydF9zdGVlbF9wbGFzdGljLWltYWdlLWt5YmNzanlvLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-80-8a8d3a06'
  where id = 'd9b3d905-7030-49a7-85da-18848636d62a'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwzMjUyNjA3NDcwOC1pbWFnZS1rdHdtb2t4ci5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-134-281f8891'
  where id = 'a7f800b8-e41d-4925-a928-00fe51728eac'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL3djbnNtbnZuYjctaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-152-22c2e0d9'
  where id = '60934685-e444-48a9-b7fc-c054c3c4c5d7'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxMzkyOC1pbWFnZS1rd3Z5ZnBydS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-170-9f2c60c5'
  where id = '414b19bb-41e3-45e4-a0da-b052a81e5d54'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAyL2xyL2dldHR5MTA4enZ2LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-224-87350ae4'
  where id = 'b07f67cd-82c4-4b01-99ba-aedcd6ee143f'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2xyL3NtaXRoc25jaHNkbTE5MzczMWVsbGVubWNkZXJtb3R0LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-242-7f49e515'
  where id = 'd84e48f1-3281-48f8-8d61-0fc8e6a8b7b2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbnMxNjk5LWltYWdlLWt3eXMwcWdtLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-260-56461d67'
  where id = 'bb90eac3-ceb1-4075-98d4-cf0ee2b0792b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2JzOTMyLWltYWdlLWt3dngwaHk1LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-314-96b0ab3e'
  where id = 'f790eb79-4253-4c20-9cce-557af190c701'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxNTg4MTE1LWltYWdlLWt3dnZwYzFxLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-332-dd6b61fd'
  where id = 'f160808e-7a5e-4365-8d59-abb6a2e066d2'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZydW5zcGxhc2gwNDE2OC1pbWFnZS1rejJlNzZ3Zi5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-350-853feb27'
  where id = 'e2ea5e80-479c-4e94-b755-5bf1e2635708'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA0L2JzMzA2LWltYWdlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-404-bd2d5fb9'
  where id = 'a21e0dcc-8419-4c98-9205-4037e7d7b432'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbnMzNTQ4LWltYWdlLWt3dndwa2QwLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-422-f70d256c'
  where id = '49076245-f546-4904-a991-d65be53f07fd'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0ODEyNDg4MDkwNy1pbWFnZS1reWJlZXliZC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-440-e9b043a0'
  where id = '3f6d84f4-2417-41f6-9d27-67c00b65ae45'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsNTEyODYwODQyNDktaW1hZ2UuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Business&key=migration-20260903-campaign-494-6ad72802'
  where id = '2a8ce2b0-29bd-4b80-9e4d-169eeff6ce04'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyNjU2Mjk3MzMwMC1pbWFnZS1reWNqbng4Ny5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-54-9258fe20'
  where id = '3138808f-ac9f-4c92-9229-9e8984c5ddd1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYyMjQwNTc3LXdpa2ltZWRpYS1pbWFnZS1rb3dzMnQ4OC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-72-04f54be8'
  where id = 'c9622547-e1b8-4d67-b82a-514a3bb9678d'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJnaWZ0X21hZGVfcGFja2FnZV9sb29wXzIxLWltYWdlLWt5YmRsM2k4LmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-90-caf4bb7c'
  where id = '4284eb26-635c-4f88-b3a5-774ca9f375a1'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxNDYwMDEzLWltYWdlLWt3dnh2ZDdnLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-144-96a17404'
  where id = '945b059d-c788-4258-8abb-1157632c2c7b'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg5MjA0MDItaW1hZ2Uta3d2eGQ1bjcuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-162-78530b13'
  where id = '0919b3ce-d329-4c1b-a303-9f56e24bf353'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxNDQyOS1pbWFnZS1rd3lzZWdmZy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-180-dc1634b9'
  where id = '7c3dd29f-13d2-47b6-b731-e294fd9696f8'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTE1OTc3Ni1pbWFnZS1rd3Z3NmlscS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-234-eb653512'
  where id = '8c1a40e1-3765-40f4-aab6-e393ff8ec018'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2lzMTgwMjUtaW1hZ2Uta3d2d3Q4ZnkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-252-b478712a'
  where id = '13866b0a-b990-4876-a467-1d9c265838ef'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZ2lmdF9tYWRlX3BhY2thZ2VfbG9vcF8xOC1pbWFnZS1reWJka2V6aS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-270-88ee2475'
  where id = 'f1113641-2cb3-4d4f-9687-5da109cf6934'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxODkxNDQzLXdpa2ltZWRpYS1pbWFnZS1rb3dleHl4eC5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-324-4ae4de9e'
  where id = 'e22e69a6-ab09-4039-8539-f6bd0d77b9fa'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L3Vwd2s2MTg1MTc4Mi13aWtpbWVkaWEtaW1hZ2Uta293cGdpNXUuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-342-a32e834f'
  where id = '1cf70197-7b58-419a-85b8-e87432a260aa'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MjI2NDQyLWltYWdlLWt3dnZnaHVlLmpwZw.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-360-cbbb8ed7'
  where id = 'd5e5f27e-0a02-49e0-aea2-45bf495d2b46'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTQ2MDAxNS1pbWFnZS1rd3Z2dXV2dS5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-414-e77895a0'
  where id = 'e83998fc-d25a-413a-a53b-ca7682372abf'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyZ2lmdF9ib3hfcHJlc2VudF9iYWNrZ3JvdW5kXzctaW1hZ2Uta3liYmVoaDkuanBn.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-432-82aeb53f'
  where id = 'aae3462e-a93f-4e6b-a8e8-3302db4f1d98'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4MTM2MjMwOS1pbWFnZS1rd3Z2ejIwdy5qcGc.jpg';
update public.campaigns set cover_image_url = 'https://www.charitme.com/media/subject?category=Wishes&key=migration-20260903-campaign-450-67964ff6'
  where id = 'daa71012-8a7a-4489-aff9-8143b1e2c670'::uuid and cover_image_url = 'https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg2NjQ0NDAtaW1hZ2Uta3d2eGtzbnMuanBn.jpg';
commit;
