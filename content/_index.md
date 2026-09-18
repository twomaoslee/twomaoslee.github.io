---
title: ''
date: 2022-10-24
type: landing
sections:
- block: about.biography
  id: about
  content:
    title: Biography
    username: admin
- block: collection
  id: posts
  content:
    title: Recent Posts
    subtitle: ''
    text: ''
    count: 3
    filters:
      folders:
      - post
      author: ''
      category: ''
      tag: ''
      exclude_featured: false
      exclude_future: false
      exclude_past: false
      publication_type: ''
    offset: 0
    order: desc
  design:
    view: compact
    columns: '2'
- block: featured-carousel
  id: featured
  content:
    title: Featured Publications
    filters:
      folders:
      - publication
      featured_only: true
  design:
    columns: '1'
    view: card
- block: collection
  content:
    title: Recent Publications
    filters:
      folders:
      - publication
      exclude_featured: false
  design:
    columns: '2'
    view: citation
- block: people
  id: team
  content:
    title: Team
    text: ''
    user_groups:
    - Graduate Students
    - Undergraduate Students
    - Alumni
    sort_by: Params.order
    sort_ascending: true
  design:
    show_interests: true
    show_role: true
    show_social: true
- block: collection
  id: projects
  content:
    title: Research Interests
    count: 4
    sort_by: Weight
    order: asc
    filters:
      folders:
      - project
  design:
    columns: '1'
    view: card
- block: collection
  id: courses
  content:
    title: Courses
    subtitle: Teaching in foundational physics and quantum science
    count: 2
    filters:
      folders:
      - course
    order: asc
  design:
    columns: '2'
    view: compact
- block: markdown
  id: gallery
  content:
    title: Gallery
    text: '{{< gallery album="group-life" mode="carousel" >}}'
  design:
    columns: '1'
- block: contact
  id: contact
  content:
    title: Contact
    subtitle:
    text: For research discussions, student supervision, or collaboration inquiries, please contact me by email.
    email: zimin.li@csu.edu.cn
    address:
      street: Central South University
      city: Changsha
      region: Hunan, China
      postcode: '410000'
      country: China
      country_code: CN
    directions: Room 437, School of Physics, Xiaoxiang Campus, Central South University
    coordinates:
      latitude: '28.1471'
      longitude: '112.9459'
    contact_links:
    autolink: true
    form:
      provider: ''
      formspree:
        id:
      netlify:
        captcha: false
  design:
    columns: '2'
---
