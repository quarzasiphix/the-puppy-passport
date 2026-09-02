export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          id: string
          processed_at: string | null
          processed_by: string | null
          profile_id: string
          reason: string | null
          requested_at: string
          status: Database["public"]["Enums"]["account_deletion_status"]
        }
        Insert: {
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id: string
          reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["account_deletion_status"]
        }
        Update: {
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string
          reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["account_deletion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          achieved_on: string | null
          admin_notes: string | null
          created_at: string
          evidence_url: string | null
          id: string
          issuing_body: string | null
          kennel_id: string
          parent_dog_id: string
          reviewed_at: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["achievement_verification_status"]
        }
        Insert: {
          achieved_on?: string | null
          admin_notes?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          issuing_body?: string | null
          kennel_id: string
          parent_dog_id: string
          reviewed_at?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["achievement_verification_status"]
        }
        Update: {
          achieved_on?: string | null
          admin_notes?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          issuing_body?: string | null
          kennel_id?: string
          parent_dog_id?: string
          reviewed_at?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["achievement_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "achievements_kennel_id_fkey"
            columns: ["kennel_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_parent_dog_id_fkey"
            columns: ["parent_dog_id"]
            isOneToOne: false
            referencedRelation: "parent_dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_images: {
        Row: {
          animal_id: string
          caption: string | null
          display_order: number
          id: string
          image_url: string
          is_cover: boolean
        }
        Insert: {
          animal_id: string
          caption?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_cover?: boolean
        }
        Update: {
          animal_id?: string
          caption?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_cover?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "animal_images_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      animal_ownership_history: {
        Row: {
          animal_id: string
          ended_at: string | null
          id: string
          owner_organization_id: string | null
          owner_profile_id: string | null
          ownership_type: string
          started_at: string
          transfer_reason: string | null
        }
        Insert: {
          animal_id: string
          ended_at?: string | null
          id?: string
          owner_organization_id?: string | null
          owner_profile_id?: string | null
          ownership_type: string
          started_at?: string
          transfer_reason?: string | null
        }
        Update: {
          animal_id?: string
          ended_at?: string | null
          id?: string
          owner_organization_id?: string | null
          owner_profile_id?: string | null
          ownership_type?: string
          started_at?: string
          transfer_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animal_ownership_history_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_ownership_history_owner_organization_id_fkey"
            columns: ["owner_organization_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_ownership_history_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          aggression_notes: string | null
          anxiety_notes: string | null
          approximate_age: string | null
          approximate_age_flag: boolean
          availability_status: Database["public"]["Enums"]["animal_availability_status"]
          behavioural_notes: string | null
          breed_id: string | null
          color: string | null
          compatibility_notes: string | null
          created_at: string
          currency: string | null
          date_of_birth: string | null
          description: string | null
          health_tests: Json
          id: string
          ideal_home: string | null
          identification_verified_status: string
          international_transport_available: boolean
          is_featured: boolean
          is_published: boolean
          listing_category: Database["public"]["Enums"]["animal_listing_category"]
          litter_id: string | null
          medication: string | null
          microchip_number: string | null
          mixed_breed: boolean
          name: string
          organization_id: string | null
          owner_profile_id: string | null
          passport_country: string | null
          price: number | null
          rabies_vaccination_date: string | null
          rabies_vaccination_status: string | null
          registry_country: string | null
          registry_name: string | null
          registry_reference: string | null
          sex: Database["public"]["Enums"]["dog_sex"] | null
          size_category: Database["public"]["Enums"]["size_category"] | null
          slug: string | null
          species_id: string
          tattoo_number: string | null
          temperament: string | null
          transport_available: boolean
          transport_crate_requirements: string | null
          updated_at: string
          weight_kg: number | null
          weight_unit: string
        }
        Insert: {
          aggression_notes?: string | null
          anxiety_notes?: string | null
          approximate_age?: string | null
          approximate_age_flag?: boolean
          availability_status?: Database["public"]["Enums"]["animal_availability_status"]
          behavioural_notes?: string | null
          breed_id?: string | null
          color?: string | null
          compatibility_notes?: string | null
          created_at?: string
          currency?: string | null
          date_of_birth?: string | null
          description?: string | null
          health_tests?: Json
          id?: string
          ideal_home?: string | null
          identification_verified_status?: string
          international_transport_available?: boolean
          is_featured?: boolean
          is_published?: boolean
          listing_category?: Database["public"]["Enums"]["animal_listing_category"]
          litter_id?: string | null
          medication?: string | null
          microchip_number?: string | null
          mixed_breed?: boolean
          name: string
          organization_id?: string | null
          owner_profile_id?: string | null
          passport_country?: string | null
          price?: number | null
          rabies_vaccination_date?: string | null
          rabies_vaccination_status?: string | null
          registry_country?: string | null
          registry_name?: string | null
          registry_reference?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          slug?: string | null
          species_id?: string
          tattoo_number?: string | null
          temperament?: string | null
          transport_available?: boolean
          transport_crate_requirements?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_unit?: string
        }
        Update: {
          aggression_notes?: string | null
          anxiety_notes?: string | null
          approximate_age?: string | null
          approximate_age_flag?: boolean
          availability_status?: Database["public"]["Enums"]["animal_availability_status"]
          behavioural_notes?: string | null
          breed_id?: string | null
          color?: string | null
          compatibility_notes?: string | null
          created_at?: string
          currency?: string | null
          date_of_birth?: string | null
          description?: string | null
          health_tests?: Json
          id?: string
          ideal_home?: string | null
          identification_verified_status?: string
          international_transport_available?: boolean
          is_featured?: boolean
          is_published?: boolean
          listing_category?: Database["public"]["Enums"]["animal_listing_category"]
          litter_id?: string | null
          medication?: string | null
          microchip_number?: string | null
          mixed_breed?: boolean
          name?: string
          organization_id?: string | null
          owner_profile_id?: string | null
          passport_country?: string | null
          price?: number | null
          rabies_vaccination_date?: string | null
          rabies_vaccination_status?: string | null
          registry_country?: string | null
          registry_name?: string | null
          registry_reference?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          slug?: string | null
          species_id?: string
          tattoo_number?: string | null
          temperament?: string | null
          transport_available?: boolean
          transport_crate_requirements?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      app_maintenance_mode: {
        Row: {
          enabled: boolean
          enabled_at: string | null
          enabled_by: string | null
          id: boolean
          message: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          id?: boolean
          message?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          id?: boolean
          message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_maintenance_mode_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      breeds: {
        Row: {
          id: string
          image_url: string | null
          name: string
          short_description: string | null
          size_category: Database["public"]["Enums"]["size_category"]
          slug: string
          species_id: string
        }
        Insert: {
          id?: string
          image_url?: string | null
          name: string
          short_description?: string | null
          size_category: Database["public"]["Enums"]["size_category"]
          slug: string
          species_id?: string
        }
        Update: {
          id?: string
          image_url?: string | null
          name?: string
          short_description?: string | null
          size_category?: Database["public"]["Enums"]["size_category"]
          slug?: string
          species_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeds_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_applications: {
        Row: {
          alone_time: string | null
          animal_id: string
          application_type: Database["public"]["Enums"]["application_type"]
          breed_knowledge: string | null
          breeder_response: string | null
          buyer_city: string | null
          buyer_country: string | null
          buyer_id: string
          children_ages: string | null
          collection_method:
            | Database["public"]["Enums"]["collection_method"]
            | null
          consent_given_at: string | null
          consent_version: string | null
          has_children: boolean | null
          has_garden: boolean | null
          housing_type: Database["public"]["Enums"]["housing_type"] | null
          id: string
          intended_purpose: string | null
          internal_notes: string | null
          landlord_permission: boolean | null
          litter_id: string | null
          message: string | null
          organisation_supplemental_answers: Json
          organization_id: string | null
          other_animals: string | null
          phone: string | null
          preferred_collection_date: string | null
          previous_experience: string | null
          status: Database["public"]["Enums"]["buyer_application_status"]
          submitted_at: string
          transport_required: boolean
          updated_at: string
          veterinary_plan: string | null
          working_schedule: string | null
        }
        Insert: {
          alone_time?: string | null
          animal_id: string
          application_type?: Database["public"]["Enums"]["application_type"]
          breed_knowledge?: string | null
          breeder_response?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_id: string
          children_ages?: string | null
          collection_method?:
            | Database["public"]["Enums"]["collection_method"]
            | null
          consent_given_at?: string | null
          consent_version?: string | null
          has_children?: boolean | null
          has_garden?: boolean | null
          housing_type?: Database["public"]["Enums"]["housing_type"] | null
          id?: string
          intended_purpose?: string | null
          internal_notes?: string | null
          landlord_permission?: boolean | null
          litter_id?: string | null
          message?: string | null
          organisation_supplemental_answers?: Json
          organization_id?: string | null
          other_animals?: string | null
          phone?: string | null
          preferred_collection_date?: string | null
          previous_experience?: string | null
          status?: Database["public"]["Enums"]["buyer_application_status"]
          submitted_at?: string
          transport_required?: boolean
          updated_at?: string
          veterinary_plan?: string | null
          working_schedule?: string | null
        }
        Update: {
          alone_time?: string | null
          animal_id?: string
          application_type?: Database["public"]["Enums"]["application_type"]
          breed_knowledge?: string | null
          breeder_response?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_id?: string
          children_ages?: string | null
          collection_method?:
            | Database["public"]["Enums"]["collection_method"]
            | null
          consent_given_at?: string | null
          consent_version?: string | null
          has_children?: boolean | null
          has_garden?: boolean | null
          housing_type?: Database["public"]["Enums"]["housing_type"] | null
          id?: string
          intended_purpose?: string | null
          internal_notes?: string | null
          landlord_permission?: boolean | null
          litter_id?: string | null
          message?: string | null
          organisation_supplemental_answers?: Json
          organization_id?: string | null
          other_animals?: string | null
          phone?: string | null
          preferred_collection_date?: string | null
          previous_experience?: string | null
          status?: Database["public"]["Enums"]["buyer_application_status"]
          submitted_at?: string
          transport_required?: boolean
          updated_at?: string
          veterinary_plan?: string | null
          working_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_applications_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_applications_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_applications_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_profile_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          is_edited: boolean
          moderation_status: Database["public"]["Enums"]["content_moderation_status"]
          parent_comment_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_profile_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          moderation_status?: Database["public"]["Enums"]["content_moderation_status"]
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          moderation_status?: Database["public"]["Enums"]["content_moderation_status"]
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reviews: {
        Row: {
          animal_fit: boolean | null
          authorisation_appropriate: boolean | null
          contingency_contact_available: boolean | null
          documents_checked: boolean | null
          id: string
          notes: string | null
          pickup_handover_confirmed: boolean | null
          reviewed_at: string
          reviewer_profile_id: string | null
          route_planned_ok: boolean | null
          transport_request_id: string
          vehicle_appropriate: boolean | null
        }
        Insert: {
          animal_fit?: boolean | null
          authorisation_appropriate?: boolean | null
          contingency_contact_available?: boolean | null
          documents_checked?: boolean | null
          id?: string
          notes?: string | null
          pickup_handover_confirmed?: boolean | null
          reviewed_at?: string
          reviewer_profile_id?: string | null
          route_planned_ok?: boolean | null
          transport_request_id: string
          vehicle_appropriate?: boolean | null
        }
        Update: {
          animal_fit?: boolean | null
          authorisation_appropriate?: boolean | null
          contingency_contact_available?: boolean | null
          documents_checked?: boolean | null
          id?: string
          notes?: string | null
          pickup_handover_confirmed?: boolean | null
          reviewed_at?: string
          reviewer_profile_id?: string | null
          route_planned_ok?: boolean | null
          transport_request_id?: string
          vehicle_appropriate?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reviews_reviewer_profile_id_fkey"
            columns: ["reviewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reviews_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reviews_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reviews_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          profile_id: string
          role_in_conversation: Database["public"]["Enums"]["conversation_participant_role"]
        }
        Insert: {
          conversation_id: string
          id?: string
          profile_id: string
          role_in_conversation?: Database["public"]["Enums"]["conversation_participant_role"]
        }
        Update: {
          conversation_id?: string
          id?: string
          profile_id?: string
          role_in_conversation?: Database["public"]["Enums"]["conversation_participant_role"]
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          id: string
          linked_animal_id: string | null
          linked_transport_request_id: string | null
          subject: string | null
        }
        Insert: {
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          id?: string
          linked_animal_id?: string | null
          linked_transport_request_id?: string | null
          subject?: string | null
        }
        Update: {
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          id?: string
          linked_animal_id?: string | null
          linked_transport_request_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_linked_animal_id_fkey"
            columns: ["linked_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_linked_transport_request_id_fkey"
            columns: ["linked_transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_linked_transport_request_id_fkey"
            columns: ["linked_transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_linked_transport_request_id_fkey"
            columns: ["linked_transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          availability_status: string | null
          contact: string | null
          created_at: string
          document_expiry_date: string | null
          emergency_contact: string | null
          home_region: string | null
          id: string
          internal_notes: string | null
          internal_verification_status: Database["public"]["Enums"]["driver_verification_status"]
          name: string
          profile_id: string | null
          qualification_status: string
          training_documents: Json
        }
        Insert: {
          availability_status?: string | null
          contact?: string | null
          created_at?: string
          document_expiry_date?: string | null
          emergency_contact?: string | null
          home_region?: string | null
          id?: string
          internal_notes?: string | null
          internal_verification_status?: Database["public"]["Enums"]["driver_verification_status"]
          name: string
          profile_id?: string | null
          qualification_status?: string
          training_documents?: Json
        }
        Update: {
          availability_status?: string | null
          contact?: string | null
          created_at?: string
          document_expiry_date?: string | null
          emergency_contact?: string | null
          home_region?: string | null
          id?: string
          internal_notes?: string | null
          internal_verification_status?: Database["public"]["Enums"]["driver_verification_status"]
          name?: string
          profile_id?: string | null
          qualification_status?: string
          training_documents?: Json
        }
        Relationships: [
          {
            foreignKeyName: "drivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followed_animal_id: string | null
          followed_breed_id: string | null
          followed_group_id: string | null
          followed_litter_id: string | null
          followed_organization_id: string | null
          followed_profile_id: string | null
          follower_profile_id: string
          id: string
        }
        Insert: {
          created_at?: string
          followed_animal_id?: string | null
          followed_breed_id?: string | null
          followed_group_id?: string | null
          followed_litter_id?: string | null
          followed_organization_id?: string | null
          followed_profile_id?: string | null
          follower_profile_id: string
          id?: string
        }
        Update: {
          created_at?: string
          followed_animal_id?: string | null
          followed_breed_id?: string | null
          followed_group_id?: string | null
          followed_litter_id?: string | null
          followed_organization_id?: string | null
          followed_profile_id?: string | null
          follower_profile_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_animal_id_fkey"
            columns: ["followed_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_breed_id_fkey"
            columns: ["followed_breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_group_id_fkey"
            columns: ["followed_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_litter_id_fkey"
            columns: ["followed_litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_organization_id_fkey"
            columns: ["followed_organization_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_profile_id_fkey"
            columns: ["followed_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_profile_id_fkey"
            columns: ["follower_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fundraising_campaigns: {
        Row: {
          animal_id: string
          buyer_application_id: string
          created_at: string
          currency: string
          deadline: string | null
          description: string | null
          excess_funds_policy: string | null
          id: string
          organisation_id: string
          quotation_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["fundraising_campaign_status"]
          target_amount: number
          title: string
          transport_request_id: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          buyer_application_id: string
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          excess_funds_policy?: string | null
          id?: string
          organisation_id: string
          quotation_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["fundraising_campaign_status"]
          target_amount: number
          title: string
          transport_request_id: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          buyer_application_id?: string
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          excess_funds_policy?: string | null
          id?: string
          organisation_id?: string
          quotation_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["fundraising_campaign_status"]
          target_amount?: number
          title?: string
          transport_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fundraising_campaigns_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_campaigns_buyer_application_id_fkey"
            columns: ["buyer_application_id"]
            isOneToOne: false
            referencedRelation: "buyer_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_campaigns_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_campaigns_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_campaigns_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_campaigns_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_campaigns_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_campaigns_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fundraising_contributions: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          currency: string
          display_publicly: boolean
          id: string
          is_simulated: boolean
          payment_provider_reference: string | null
          payment_status: Database["public"]["Enums"]["fundraising_payment_status"]
          public_message: string | null
          supporter_profile_id: string
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          currency?: string
          display_publicly?: boolean
          id?: string
          is_simulated?: boolean
          payment_provider_reference?: string | null
          payment_status?: Database["public"]["Enums"]["fundraising_payment_status"]
          public_message?: string | null
          supporter_profile_id: string
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          display_publicly?: boolean
          id?: string
          is_simulated?: boolean
          payment_provider_reference?: string | null
          payment_status?: Database["public"]["Enums"]["fundraising_payment_status"]
          public_message?: string | null
          supporter_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fundraising_contributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fundraising_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_contributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_fundraising_totals"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "fundraising_contributions_supporter_profile_id_fkey"
            columns: ["supporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          profile_id: string
          role: Database["public"]["Enums"]["group_member_role"]
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          profile_id: string
          role?: Database["public"]["Enums"]["group_member_role"]
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["group_member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          group_type: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_type?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_type?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      handover_protocols: {
        Row: {
          confirmed_at: string
          confirmed_by: string | null
          handover_type: Database["public"]["Enums"]["handover_type"]
          id: string
          notes: string | null
          photo_url: string | null
          recipient_name: string | null
          signature_note: string | null
          transport_request_id: string
        }
        Insert: {
          confirmed_at?: string
          confirmed_by?: string | null
          handover_type: Database["public"]["Enums"]["handover_type"]
          id?: string
          notes?: string | null
          photo_url?: string | null
          recipient_name?: string | null
          signature_note?: string | null
          transport_request_id: string
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string | null
          handover_type?: Database["public"]["Enums"]["handover_type"]
          id?: string
          notes?: string | null
          photo_url?: string | null
          recipient_name?: string | null
          signature_note?: string | null
          transport_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_protocols_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_protocols_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_protocols_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_protocols_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          document_type: Database["public"]["Enums"]["legal_document_type"]
          id: string
          is_current: boolean
          published_at: string
          version: string
        }
        Insert: {
          document_type: Database["public"]["Enums"]["legal_document_type"]
          id?: string
          is_current?: boolean
          published_at?: string
          version: string
        }
        Update: {
          document_type?: Database["public"]["Enums"]["legal_document_type"]
          id?: string
          is_current?: boolean
          published_at?: string
          version?: string
        }
        Relationships: []
      }
      legal_holds: {
        Row: {
          id: string
          placed_at: string
          placed_by: string
          reason: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          subject_profile_id: string
        }
        Insert: {
          id?: string
          placed_at?: string
          placed_by: string
          reason: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          subject_profile_id: string
        }
        Update: {
          id?: string
          placed_at?: string
          placed_by?: string
          reason?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          subject_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_holds_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_holds_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_holds_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_requirements: {
        Row: {
          category: Database["public"]["Enums"]["legal_requirement_category"]
          country: string
          created_at: string
          created_by: string | null
          effective_date: string | null
          enforcement_level: Database["public"]["Enums"]["legal_requirement_enforcement"]
          id: string
          is_published: boolean
          last_reviewed_at: string
          reviewer_id: string | null
          source_name: string | null
          source_url: string
          species_id: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["legal_requirement_category"]
          country: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          enforcement_level?: Database["public"]["Enums"]["legal_requirement_enforcement"]
          id?: string
          is_published?: boolean
          last_reviewed_at: string
          reviewer_id?: string | null
          source_name?: string | null
          source_url: string
          species_id?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["legal_requirement_category"]
          country?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          enforcement_level?: Database["public"]["Enums"]["legal_requirement_enforcement"]
          id?: string
          is_published?: boolean
          last_reviewed_at?: string
          reviewer_id?: string | null
          source_name?: string | null
          source_url?: string
          species_id?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_requirements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_requirements_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_requirements_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      litters: {
        Row: {
          association: string | null
          birth_date: string | null
          breed_id: string | null
          code: string
          created_at: string
          description: string | null
          expected_birth_date: string | null
          father_id: string | null
          female_count: number | null
          health_info: Json
          id: string
          is_published: boolean
          kennel_id: string
          male_count: number | null
          mother_id: string | null
          puppy_count: number | null
          ready_date: string | null
          registration_number: string | null
          status: Database["public"]["Enums"]["litter_status"]
          updated_at: string
        }
        Insert: {
          association?: string | null
          birth_date?: string | null
          breed_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          expected_birth_date?: string | null
          father_id?: string | null
          female_count?: number | null
          health_info?: Json
          id?: string
          is_published?: boolean
          kennel_id: string
          male_count?: number | null
          mother_id?: string | null
          puppy_count?: number | null
          ready_date?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["litter_status"]
          updated_at?: string
        }
        Update: {
          association?: string | null
          birth_date?: string | null
          breed_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          expected_birth_date?: string | null
          father_id?: string | null
          female_count?: number | null
          health_info?: Json
          id?: string
          is_published?: boolean
          kennel_id?: string
          male_count?: number | null
          mother_id?: string | null
          puppy_count?: number | null
          ready_date?: string | null
          registration_number?: string | null
          status?: Database["public"]["Enums"]["litter_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "litters_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litters_father_id_fkey"
            columns: ["father_id"]
            isOneToOne: false
            referencedRelation: "parent_dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litters_kennel_id_fkey"
            columns: ["kennel_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litters_mother_id_fkey"
            columns: ["mother_id"]
            isOneToOne: false
            referencedRelation: "parent_dogs"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          adoption_state: Database["public"]["Enums"]["market_state"]
          breeder_verification_state: Database["public"]["Enums"]["market_state"]
          country_code: string
          created_at: string
          currency: string
          default_locale: string
          display_name: string
          enabled: boolean
          fundraising_state: Database["public"]["Enums"]["market_state"]
          id: string
          legal_content_ready: boolean
          marketplace_state: Database["public"]["Enums"]["market_state"]
          supported_locales: string[]
          transport_full_state: Database["public"]["Enums"]["market_state"]
          transport_post_state: Database["public"]["Enums"]["market_state"]
          updated_at: string
        }
        Insert: {
          adoption_state?: Database["public"]["Enums"]["market_state"]
          breeder_verification_state?: Database["public"]["Enums"]["market_state"]
          country_code: string
          created_at?: string
          currency?: string
          default_locale?: string
          display_name: string
          enabled?: boolean
          fundraising_state?: Database["public"]["Enums"]["market_state"]
          id?: string
          legal_content_ready?: boolean
          marketplace_state?: Database["public"]["Enums"]["market_state"]
          supported_locales?: string[]
          transport_full_state?: Database["public"]["Enums"]["market_state"]
          transport_post_state?: Database["public"]["Enums"]["market_state"]
          updated_at?: string
        }
        Update: {
          adoption_state?: Database["public"]["Enums"]["market_state"]
          breeder_verification_state?: Database["public"]["Enums"]["market_state"]
          country_code?: string
          created_at?: string
          currency?: string
          default_locale?: string
          display_name?: string
          enabled?: boolean
          fundraising_state?: Database["public"]["Enums"]["market_state"]
          id?: string
          legal_content_ready?: boolean
          marketplace_state?: Database["public"]["Enums"]["market_state"]
          supported_locales?: string[]
          transport_full_state?: Database["public"]["Enums"]["market_state"]
          transport_post_state?: Database["public"]["Enums"]["market_state"]
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_url: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_internal: boolean
          message_kind: Database["public"]["Enums"]["message_kind"]
          sender_profile_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          message_kind?: Database["public"]["Enums"]["message_kind"]
          sender_profile_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          message_kind?: Database["public"]["Enums"]["message_kind"]
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_appeals: {
        Row: {
          created_at: string
          id: string
          internal_notes: string | null
          moderation_case_id: string
          outcome_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          statement: string
          status: Database["public"]["Enums"]["moderation_appeal_status"]
          submitted_by: string
          supporting_document_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          moderation_case_id: string
          outcome_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement: string
          status?: Database["public"]["Enums"]["moderation_appeal_status"]
          submitted_by: string
          supporting_document_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          moderation_case_id?: string
          outcome_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement?: string
          status?: Database["public"]["Enums"]["moderation_appeal_status"]
          submitted_by?: string
          supporting_document_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_moderation_case_id_fkey"
            columns: ["moderation_case_id"]
            isOneToOne: true
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_moderation_case_id_fkey"
            columns: ["moderation_case_id"]
            isOneToOne: true
            referencedRelation: "my_moderation_case_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          affected_profile_id: string | null
          appeal_deadline: string | null
          appeal_status: Database["public"]["Enums"]["appeal_status"]
          assigned_moderator_id: string | null
          case_type: string
          created_at: string
          decision: string | null
          decision_explanation: string | null
          id: string
          public_decision_summary: string | null
          report_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["moderation_case_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          affected_profile_id?: string | null
          appeal_deadline?: string | null
          appeal_status?: Database["public"]["Enums"]["appeal_status"]
          assigned_moderator_id?: string | null
          case_type: string
          created_at?: string
          decision?: string | null
          decision_explanation?: string | null
          id?: string
          public_decision_summary?: string | null
          report_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          affected_profile_id?: string | null
          appeal_deadline?: string | null
          appeal_status?: Database["public"]["Enums"]["appeal_status"]
          assigned_moderator_id?: string | null
          case_type?: string
          created_at?: string
          decision?: string | null
          decision_explanation?: string | null
          id?: string
          public_decision_summary?: string | null
          report_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_affected_profile_id_fkey"
            columns: ["affected_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_assigned_moderator_id_fkey"
            columns: ["assigned_moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          id: string
          in_app_enabled: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          in_app_enabled?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          in_app_enabled?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_profile_id: string | null
          body: string | null
          created_at: string
          dedup_key: string | null
          id: string
          is_read: boolean
          link_url: string | null
          notification_type: string
          profile_id: string
          template_version: number | null
          title: string
        }
        Insert: {
          actor_profile_id?: string | null
          body?: string | null
          created_at?: string
          dedup_key?: string | null
          id?: string
          is_read?: boolean
          link_url?: string | null
          notification_type: string
          profile_id: string
          template_version?: number | null
          title: string
        }
        Update: {
          actor_profile_id?: string | null
          body?: string | null
          created_at?: string
          dedup_key?: string | null
          id?: string
          is_read?: boolean
          link_url?: string | null
          notification_type?: string
          profile_id?: string
          template_version?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_domains: {
        Row: {
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
          organisation_id: string
          status: Database["public"]["Enums"]["organisation_domain_status"]
          type: Database["public"]["Enums"]["organisation_domain_type"]
          updated_at: string
          verification_token: string | null
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
          organisation_id: string
          status?: Database["public"]["Enums"]["organisation_domain_status"]
          type: Database["public"]["Enums"]["organisation_domain_type"]
          updated_at?: string
          verification_token?: string | null
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          organisation_id?: string
          status?: Database["public"]["Enums"]["organisation_domain_status"]
          type?: Database["public"]["Enums"]["organisation_domain_type"]
          updated_at?: string
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_domains_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invitations: {
        Row: {
          accepted_by: string | null
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string
          invited_role: Database["public"]["Enums"]["org_member_role"]
          org_id: string
          status: Database["public"]["Enums"]["org_invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          invited_email: string
          invited_role: Database["public"]["Enums"]["org_member_role"]
          org_id: string
          status?: Database["public"]["Enums"]["org_invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          invited_role?: Database["public"]["Enums"]["org_member_role"]
          org_id?: string
          status?: Database["public"]["Enums"]["org_invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          id: string
          member_role: Database["public"]["Enums"]["org_member_role"]
          org_id: string
          profile_id: string
          status: Database["public"]["Enums"]["org_member_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          org_id: string
          profile_id: string
          status?: Database["public"]["Enums"]["org_member_status"]
        }
        Update: {
          created_at?: string
          id?: string
          member_role?: Database["public"]["Enums"]["org_member_role"]
          org_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["org_member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_site_configurations: {
        Row: {
          contact_mode: Database["public"]["Enums"]["kennel_contact_mode"]
          cover_asset_id: string | null
          created_at: string
          default_language: string
          logo_asset_id: string | null
          organisation_id: string
          primary_color: string | null
          section_order: Database["public"]["Enums"]["kennel_section"][]
          show_anemalo_branding: boolean
          supported_languages: string[]
          theme: Database["public"]["Enums"]["kennel_theme"]
          updated_at: string
          visible_sections: Database["public"]["Enums"]["kennel_section"][]
        }
        Insert: {
          contact_mode?: Database["public"]["Enums"]["kennel_contact_mode"]
          cover_asset_id?: string | null
          created_at?: string
          default_language?: string
          logo_asset_id?: string | null
          organisation_id: string
          primary_color?: string | null
          section_order?: Database["public"]["Enums"]["kennel_section"][]
          show_anemalo_branding?: boolean
          supported_languages?: string[]
          theme?: Database["public"]["Enums"]["kennel_theme"]
          updated_at?: string
          visible_sections?: Database["public"]["Enums"]["kennel_section"][]
        }
        Update: {
          contact_mode?: Database["public"]["Enums"]["kennel_contact_mode"]
          cover_asset_id?: string | null
          created_at?: string
          default_language?: string
          logo_asset_id?: string | null
          organisation_id?: string
          primary_color?: string | null
          section_order?: Database["public"]["Enums"]["kennel_section"][]
          show_anemalo_branding?: boolean
          supported_languages?: string[]
          theme?: Database["public"]["Enums"]["kennel_theme"]
          updated_at?: string
          visible_sections?: Database["public"]["Enums"]["kennel_section"][]
        }
        Relationships: [
          {
            foreignKeyName: "organisation_site_configurations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          association_name: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          international_transport_available: boolean
          is_featured: boolean
          is_public: boolean
          logo_url: string | null
          membership_number: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          owner_user_id: string
          plan: string
          private_address_id: string | null
          public_location: string | null
          registration_number: string | null
          response_time: string | null
          slug: string
          transport_available: boolean
          updated_at: string
          verification_status: Database["public"]["Enums"]["org_verification_status"]
          years_experience: number | null
        }
        Insert: {
          association_name?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          international_transport_available?: boolean
          is_featured?: boolean
          is_public?: boolean
          logo_url?: string | null
          membership_number?: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          owner_user_id: string
          plan?: string
          private_address_id?: string | null
          public_location?: string | null
          registration_number?: string | null
          response_time?: string | null
          slug: string
          transport_available?: boolean
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["org_verification_status"]
          years_experience?: number | null
        }
        Update: {
          association_name?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          international_transport_available?: boolean
          is_featured?: boolean
          is_public?: boolean
          logo_url?: string | null
          membership_number?: string | null
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          owner_user_id?: string
          plan?: string
          private_address_id?: string | null
          public_location?: string | null
          registration_number?: string | null
          response_time?: string | null
          slug?: string
          transport_available?: boolean
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["org_verification_status"]
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organisations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisations_private_address_fk"
            columns: ["private_address_id"]
            isOneToOne: false
            referencedRelation: "private_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_dogs: {
        Row: {
          breed_id: string | null
          call_name: string | null
          color: string | null
          created_at: string
          date_of_birth: string | null
          description: string | null
          health_tests: Json
          id: string
          is_active: boolean
          kennel_id: string
          microchip_number: string | null
          pedigree_number: string | null
          profile_image_url: string | null
          registered_name: string
          sex: Database["public"]["Enums"]["dog_sex"]
          titles: string | null
          updated_at: string
        }
        Insert: {
          breed_id?: string | null
          call_name?: string | null
          color?: string | null
          created_at?: string
          date_of_birth?: string | null
          description?: string | null
          health_tests?: Json
          id?: string
          is_active?: boolean
          kennel_id: string
          microchip_number?: string | null
          pedigree_number?: string | null
          profile_image_url?: string | null
          registered_name: string
          sex: Database["public"]["Enums"]["dog_sex"]
          titles?: string | null
          updated_at?: string
        }
        Update: {
          breed_id?: string | null
          call_name?: string | null
          color?: string | null
          created_at?: string
          date_of_birth?: string | null
          description?: string | null
          health_tests?: Json
          id?: string
          is_active?: boolean
          kennel_id?: string
          microchip_number?: string | null
          pedigree_number?: string | null
          profile_image_url?: string | null
          registered_name?: string
          sex?: Database["public"]["Enums"]["dog_sex"]
          titles?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_dogs_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_dogs_kennel_id_fkey"
            columns: ["kennel_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          media_type: Database["public"]["Enums"]["post_media_type"]
          media_url: string
          post_id: string
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          media_type?: Database["public"]["Enums"]["post_media_type"]
          media_url: string
          post_id: string
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          media_type?: Database["public"]["Enums"]["post_media_type"]
          media_url?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_organization_id: string | null
          author_profile_id: string | null
          auto_published: boolean
          content: string | null
          created_at: string
          deleted_at: string | null
          group_id: string | null
          id: string
          image_urls: string[]
          linked_achievement_id: string | null
          linked_animal_id: string | null
          linked_litter_id: string | null
          linked_route_id: string | null
          linked_transport_request_id: string | null
          moderation_status: Database["public"]["Enums"]["content_moderation_status"]
          post_type: Database["public"]["Enums"]["post_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          author_organization_id?: string | null
          author_profile_id?: string | null
          auto_published?: boolean
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          image_urls?: string[]
          linked_achievement_id?: string | null
          linked_animal_id?: string | null
          linked_litter_id?: string | null
          linked_route_id?: string | null
          linked_transport_request_id?: string | null
          moderation_status?: Database["public"]["Enums"]["content_moderation_status"]
          post_type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          author_organization_id?: string | null
          author_profile_id?: string | null
          auto_published?: boolean
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          image_urls?: string[]
          linked_achievement_id?: string | null
          linked_animal_id?: string | null
          linked_litter_id?: string | null
          linked_route_id?: string | null
          linked_transport_request_id?: string | null
          moderation_status?: Database["public"]["Enums"]["content_moderation_status"]
          post_type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_organization_id_fkey"
            columns: ["author_organization_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_achievement_id_fkey"
            columns: ["linked_achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_animal_id_fkey"
            columns: ["linked_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_litter_id_fkey"
            columns: ["linked_litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_route_id_fkey"
            columns: ["linked_route_id"]
            isOneToOne: false
            referencedRelation: "public_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_route_id_fkey"
            columns: ["linked_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_transport_request_id_fkey"
            columns: ["linked_transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_transport_request_id_fkey"
            columns: ["linked_transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_linked_transport_request_id_fkey"
            columns: ["linked_transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          active: boolean
          amount: number
          applies_to: string | null
          created_at: string
          currency: string
          id: string
          is_percentage: boolean
          notes: string | null
          rule_type: Database["public"]["Enums"]["pricing_rule_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          applies_to?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_percentage?: boolean
          notes?: string | null
          rule_type: Database["public"]["Enums"]["pricing_rule_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          applies_to?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_percentage?: boolean
          notes?: string | null
          rule_type?: Database["public"]["Enums"]["pricing_rule_type"]
          updated_at?: string
        }
        Relationships: []
      }
      private_addresses: {
        Row: {
          address_label: string | null
          apartment: string | null
          building_number: string | null
          city: string
          country: string
          created_at: string
          id: string
          is_verified: boolean
          latitude: number | null
          longitude: number | null
          owner_org_id: string | null
          owner_user_id: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          address_label?: string | null
          apartment?: string | null
          building_number?: string | null
          city: string
          country: string
          created_at?: string
          id?: string
          is_verified?: boolean
          latitude?: number | null
          longitude?: number | null
          owner_org_id?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          address_label?: string | null
          apartment?: string | null
          building_number?: string | null
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_verified?: boolean
          latitude?: number | null
          longitude?: number | null
          owner_org_id?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_addresses_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_addresses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_service_categories: {
        Row: {
          category_group: Database["public"]["Enums"]["product_service_category_group"]
          config: Json
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          key: string
          sort_order: number
        }
        Insert: {
          category_group: Database["public"]["Enums"]["product_service_category_group"]
          config?: Json
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          key: string
          sort_order?: number
        }
        Update: {
          category_group?: Database["public"]["Enums"]["product_service_category_group"]
          config?: Json
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          key?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          is_deleted: boolean
          last_name: string | null
          phone: string | null
          preferred_currency: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          is_deleted?: boolean
          last_name?: string | null
          phone?: string | null
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_deleted?: boolean
          last_name?: string | null
          phone?: string | null
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotations: {
        Row: {
          assumptions: string | null
          base_price: number | null
          cancellation_conditions: string | null
          created_at: string
          created_by: string | null
          currency: string
          destination: string | null
          document_conditions: string | null
          estimated_route: string | null
          expiry_date: string | null
          id: string
          optional_services: Json
          pickup: string | null
          planned_date_range: string | null
          service_type: Database["public"]["Enums"]["transport_service_type"]
          status: Database["public"]["Enums"]["quotation_status"]
          total_price: number | null
          transport_request_id: string
          updated_at: string
        }
        Insert: {
          assumptions?: string | null
          base_price?: number | null
          cancellation_conditions?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          destination?: string | null
          document_conditions?: string | null
          estimated_route?: string | null
          expiry_date?: string | null
          id?: string
          optional_services?: Json
          pickup?: string | null
          planned_date_range?: string | null
          service_type: Database["public"]["Enums"]["transport_service_type"]
          status?: Database["public"]["Enums"]["quotation_status"]
          total_price?: number | null
          transport_request_id: string
          updated_at?: string
        }
        Update: {
          assumptions?: string | null
          base_price?: number | null
          cancellation_conditions?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          destination?: string | null
          document_conditions?: string | null
          estimated_route?: string | null
          expiry_date?: string | null
          id?: string
          optional_services?: Json
          pickup?: string | null
          planned_date_range?: string | null
          service_type?: Database["public"]["Enums"]["transport_service_type"]
          status?: Database["public"]["Enums"]["quotation_status"]
          total_price?: number | null
          transport_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          action_key: string
          actor_profile_id: string
          created_at: string
          id: string
        }
        Insert: {
          action_key: string
          actor_profile_id: string
          created_at?: string
          id?: string
        }
        Update: {
          action_key?: string
          actor_profile_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          profile_id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          profile_id: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          profile_id?: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rehoming_reviews: {
        Row: {
          admin_notes: string | null
          admin_status: Database["public"]["Enums"]["rehoming_admin_status"]
          animal_id: string
          created_at: string
          id: string
          owner_profile_id: string
          ownership_declaration: boolean
          reason_for_rehoming: string
          reviewed_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          admin_status?: Database["public"]["Enums"]["rehoming_admin_status"]
          animal_id: string
          created_at?: string
          id?: string
          owner_profile_id: string
          ownership_declaration?: boolean
          reason_for_rehoming: string
          reviewed_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          admin_status?: Database["public"]["Enums"]["rehoming_admin_status"]
          animal_id?: string
          created_at?: string
          id?: string
          owner_profile_id?: string
          ownership_declaration?: boolean
          reason_for_rehoming?: string
          reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehoming_reviews_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehoming_reviews_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          evidence_url: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_profile_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_profile_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          evidence_url?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_profile_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          agreed_price: number | null
          agreement_status: Database["public"]["Enums"]["agreement_status"]
          animal_id: string
          application_id: string
          buyer_id: string
          collection_method:
            | Database["public"]["Enums"]["collection_method"]
            | null
          created_at: string
          currency: string | null
          deposit_amount: number | null
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          id: string
          litter_id: string | null
          notes: string | null
          organization_id: string
          planned_collection_date: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          agreement_status?: Database["public"]["Enums"]["agreement_status"]
          animal_id: string
          application_id: string
          buyer_id: string
          collection_method?:
            | Database["public"]["Enums"]["collection_method"]
            | null
          created_at?: string
          currency?: string | null
          deposit_amount?: number | null
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          id?: string
          litter_id?: string | null
          notes?: string | null
          organization_id: string
          planned_collection_date?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          agreement_status?: Database["public"]["Enums"]["agreement_status"]
          animal_id?: string
          application_id?: string
          buyer_id?: string
          collection_method?:
            | Database["public"]["Enums"]["collection_method"]
            | null
          created_at?: string
          currency?: string | null
          deposit_amount?: number | null
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          id?: string
          litter_id?: string | null
          notes?: string | null
          organization_id?: string
          planned_collection_date?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "buyer_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_signals: {
        Row: {
          explanation: string
          first_seen_at: string
          id: string
          is_false_positive: boolean | null
          last_seen_at: string
          occurrence_count: number
          resolution_notes: string | null
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          rule_version: string
          signal_type: Database["public"]["Enums"]["risk_signal_type"]
          source_event_type: string
          subject_profile_id: string
        }
        Insert: {
          explanation: string
          first_seen_at?: string
          id?: string
          is_false_positive?: boolean | null
          last_seen_at?: string
          occurrence_count?: number
          resolution_notes?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_version: string
          signal_type: Database["public"]["Enums"]["risk_signal_type"]
          source_event_type: string
          subject_profile_id: string
        }
        Update: {
          explanation?: string
          first_seen_at?: string
          id?: string
          is_false_positive?: boolean | null
          last_seen_at?: string
          occurrence_count?: number
          resolution_notes?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_version?: string
          signal_type?: Database["public"]["Enums"]["risk_signal_type"]
          source_event_type?: string
          subject_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_signals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_signals_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          compatibility_checked: boolean
          compatibility_notes: string | null
          hold_expires_at: string | null
          id: string
          reservation_status: Database["public"]["Enums"]["route_reservation_status"]
          route_id: string
          transport_request_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          compatibility_checked?: boolean
          compatibility_notes?: string | null
          hold_expires_at?: string | null
          id?: string
          reservation_status?: Database["public"]["Enums"]["route_reservation_status"]
          route_id: string
          transport_request_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          compatibility_checked?: boolean
          compatibility_notes?: string | null
          hold_expires_at?: string | null
          id?: string
          reservation_status?: Database["public"]["Enums"]["route_reservation_status"]
          route_id?: string
          transport_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "public_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          city: string | null
          country: string | null
          id: string
          planned_time: string | null
          route_id: string
          stop_order: number
          stop_type: Database["public"]["Enums"]["route_stop_type"]
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string
          planned_time?: string | null
          route_id: string
          stop_order: number
          stop_type?: Database["public"]["Enums"]["route_stop_type"]
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string
          planned_time?: string | null
          route_id?: string
          stop_order?: number
          stop_type?: Database["public"]["Enums"]["route_stop_type"]
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "public_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_waitlist: {
        Row: {
          created_at: string
          destination_country: string
          earliest_date: string | null
          id: string
          latest_date: string | null
          matched_route_id: string | null
          notes: string | null
          origin_country: string
          profile_id: string
          status: Database["public"]["Enums"]["route_waitlist_status"]
        }
        Insert: {
          created_at?: string
          destination_country: string
          earliest_date?: string | null
          id?: string
          latest_date?: string | null
          matched_route_id?: string | null
          notes?: string | null
          origin_country: string
          profile_id: string
          status?: Database["public"]["Enums"]["route_waitlist_status"]
        }
        Update: {
          created_at?: string
          destination_country?: string
          earliest_date?: string | null
          id?: string
          latest_date?: string | null
          matched_route_id?: string | null
          notes?: string | null
          origin_country?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["route_waitlist_status"]
        }
        Relationships: [
          {
            foreignKeyName: "route_waitlist_matched_route_id_fkey"
            columns: ["matched_route_id"]
            isOneToOne: false
            referencedRelation: "public_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_waitlist_matched_route_id_fkey"
            columns: ["matched_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_waitlist_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          customer_revenue_estimate: number | null
          departure_date: string | null
          destination_countries: string[]
          destination_regions: string[]
          driver_id: string | null
          id: string
          internal_cost_estimate: number | null
          max_capacity: number
          origin_country: string | null
          origin_region: string | null
          planned_stops: Json
          route_name: string
          route_number: string | null
          status: Database["public"]["Enums"]["route_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          customer_revenue_estimate?: number | null
          departure_date?: string | null
          destination_countries?: string[]
          destination_regions?: string[]
          driver_id?: string | null
          id?: string
          internal_cost_estimate?: number | null
          max_capacity?: number
          origin_country?: string | null
          origin_region?: string | null
          planned_stops?: Json
          route_name: string
          route_number?: string | null
          status?: Database["public"]["Enums"]["route_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          customer_revenue_estimate?: number | null
          departure_date?: string | null
          destination_countries?: string[]
          destination_regions?: string[]
          driver_id?: string | null
          id?: string
          internal_cost_estimate?: number | null
          max_capacity?: number
          origin_country?: string | null
          origin_region?: string | null
          planned_stops?: Json
          route_name?: string
          route_number?: string | null
          status?: Database["public"]["Enums"]["route_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_animals: {
        Row: {
          animal_id: string
          buyer_id: string
          id: string
          saved_at: string
        }
        Insert: {
          animal_id: string
          buyer_id: string
          id?: string
          saved_at?: string
        }
        Update: {
          animal_id?: string
          buyer_id?: string
          id?: string
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_animals_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_animals_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          display_name: string
          enabled: boolean
          id: string
          key: Database["public"]["Enums"]["species_key"]
          sort_order: number
        }
        Insert: {
          display_name: string
          enabled?: boolean
          id: string
          key: Database["public"]["Enums"]["species_key"]
          sort_order?: number
        }
        Update: {
          display_name?: string
          enabled?: boolean
          id?: string
          key?: Database["public"]["Enums"]["species_key"]
          sort_order?: number
        }
        Relationships: []
      }
      support_case_messages: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          is_internal: boolean
          sender_profile_id: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_profile_id: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_case_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_staff_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["support_case_priority"]
          related_entity_id: string | null
          related_entity_type: string | null
          requester_profile_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_case_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["support_case_priority"]
          related_entity_id?: string | null
          related_entity_type?: string | null
          requester_profile_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["support_case_priority"]
          related_entity_id?: string | null
          related_entity_type?: string | null
          requester_profile_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_documents: {
        Row: {
          category: Database["public"]["Enums"]["transport_document_category"]
          created_at: string
          expiry_date: string | null
          file_url: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["transport_document_status"]
          transport_party_id: string | null
          transport_request_id: string
          uploaded_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["transport_document_category"]
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transport_document_status"]
          transport_party_id?: string | null
          transport_request_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["transport_document_category"]
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transport_document_status"]
          transport_party_id?: string | null
          transport_request_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_documents_transport_party_id_fkey"
            columns: ["transport_party_id"]
            isOneToOne: false
            referencedRelation: "transport_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_documents_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_documents_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_documents_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_incidents: {
        Row: {
          created_at: string
          description: string
          id: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          occurred_at: string
          reported_by: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          transport_request_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          occurred_at?: string
          reported_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          transport_request_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          occurred_at?: string
          reported_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          transport_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_incidents_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_incidents_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_incidents_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_operator_authorisations: {
        Row: {
          authorisation_number: string | null
          authorisation_type: Database["public"]["Enums"]["operator_authorisation_type"]
          countries_covered: string[]
          created_at: string
          expiry_date: string | null
          id: string
          issuing_authority: string | null
          status: Database["public"]["Enums"]["operator_authorisation_status"]
          supporting_document_url: string | null
          valid_from: string | null
        }
        Insert: {
          authorisation_number?: string | null
          authorisation_type: Database["public"]["Enums"]["operator_authorisation_type"]
          countries_covered?: string[]
          created_at?: string
          expiry_date?: string | null
          id?: string
          issuing_authority?: string | null
          status?: Database["public"]["Enums"]["operator_authorisation_status"]
          supporting_document_url?: string | null
          valid_from?: string | null
        }
        Update: {
          authorisation_number?: string | null
          authorisation_type?: Database["public"]["Enums"]["operator_authorisation_type"]
          countries_covered?: string[]
          created_at?: string
          expiry_date?: string | null
          id?: string
          issuing_authority?: string | null
          status?: Database["public"]["Enums"]["operator_authorisation_status"]
          supporting_document_url?: string | null
          valid_from?: string | null
        }
        Relationships: []
      }
      transport_parties: {
        Row: {
          created_at: string
          external_email: string | null
          external_name: string | null
          external_phone: string | null
          id: string
          organisation_id: string | null
          party_role: Database["public"]["Enums"]["transport_party_role"]
          profile_id: string | null
          transport_request_id: string
        }
        Insert: {
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          external_phone?: string | null
          id?: string
          organisation_id?: string | null
          party_role: Database["public"]["Enums"]["transport_party_role"]
          profile_id?: string | null
          transport_request_id: string
        }
        Update: {
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          external_phone?: string | null
          id?: string
          organisation_id?: string | null
          party_role?: Database["public"]["Enums"]["transport_party_role"]
          profile_id?: string | null
          transport_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_parties_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_parties_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_parties_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_parties_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_parties_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_request_amendments: {
        Row: {
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["transport_amendment_status"]
          transport_request_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          old_value?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transport_amendment_status"]
          transport_request_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transport_amendment_status"]
          transport_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_request_amendments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_request_amendments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_request_amendments_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_request_amendments_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_request_amendments_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_request_animals: {
        Row: {
          animal_id: string | null
          anxiety_or_aggression_notes: string | null
          approximate_age: string | null
          behavioural_notes: string | null
          breed_free_text: string | null
          can_travel_with_others: boolean | null
          crate_requirements: string | null
          created_at: string
          health_condition: string | null
          id: string
          medication: string | null
          microchip_known: boolean
          microchip_number: string | null
          name: string | null
          passport_available: boolean | null
          position: number
          rabies_vaccination_date: string | null
          sex: Database["public"]["Enums"]["dog_sex"] | null
          size_category: Database["public"]["Enums"]["size_category"] | null
          transport_request_id: string
          vaccination_status: string | null
          weight_kg: number | null
        }
        Insert: {
          animal_id?: string | null
          anxiety_or_aggression_notes?: string | null
          approximate_age?: string | null
          behavioural_notes?: string | null
          breed_free_text?: string | null
          can_travel_with_others?: boolean | null
          crate_requirements?: string | null
          created_at?: string
          health_condition?: string | null
          id?: string
          medication?: string | null
          microchip_known?: boolean
          microchip_number?: string | null
          name?: string | null
          passport_available?: boolean | null
          position?: number
          rabies_vaccination_date?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          transport_request_id: string
          vaccination_status?: string | null
          weight_kg?: number | null
        }
        Update: {
          animal_id?: string | null
          anxiety_or_aggression_notes?: string | null
          approximate_age?: string | null
          behavioural_notes?: string | null
          breed_free_text?: string | null
          can_travel_with_others?: boolean | null
          crate_requirements?: string | null
          created_at?: string
          health_condition?: string | null
          id?: string
          medication?: string | null
          microchip_known?: boolean
          microchip_number?: string | null
          name?: string | null
          passport_available?: boolean | null
          position?: number
          rabies_vaccination_date?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          transport_request_id?: string
          vaccination_status?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_request_animals_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_request_animals_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_request_animals_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_request_animals_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_requests: {
        Row: {
          animal_id: string | null
          animal_name: string | null
          anxiety_or_aggression_notes: string | null
          approximate_age: string | null
          assigned_driver_id: string | null
          assigned_route_id: string | null
          assigned_vehicle_id: string | null
          behavioural_notes: string | null
          breed_free_text: string | null
          can_travel_with_others: boolean | null
          compliance_review_result: Database["public"]["Enums"]["transport_compliance_result"]
          confirmed_accurate: boolean
          confirmed_authority: boolean
          confirmed_understands_publication_not_confirmation: boolean
          confirmed_understands_review: boolean
          confirmed_will_provide_documents: boolean
          crate_requirements: string | null
          created_at: string
          current_owner_profile_id: string | null
          delivery_type: Database["public"]["Enums"]["transport_delivery_type"]
          destination_address_exact: string | null
          destination_area_approx: string | null
          destination_city: string | null
          destination_country: string | null
          destination_treatment_required: boolean | null
          earliest_date: string | null
          flexible_dates: boolean
          has_microchip: boolean | null
          has_passport: boolean | null
          health_certificate_required: boolean | null
          health_condition: string | null
          id: string
          is_adoption: boolean | null
          is_domestic: boolean | null
          is_ownership_change: boolean | null
          is_sale: boolean | null
          latest_date: string | null
          medically_fit_for_transport: boolean | null
          medication: string | null
          microchip_known: boolean
          microchip_number: string | null
          number_of_animals: number
          origin_registered_or_approved: boolean | null
          owner_travel_within_5_days: boolean | null
          ownership_changing: boolean
          passport_available: boolean | null
          payer_profile_id: string | null
          pickup_address_exact: string | null
          pickup_area_approx: string | null
          pickup_city: string | null
          pickup_country: string | null
          rabies_vaccination_date: string | null
          rabies_valid: boolean | null
          receive_authorized_by: string | null
          recipient_profile_id: string | null
          release_authorized_by: string | null
          request_number: string | null
          request_purpose: Database["public"]["Enums"]["transport_request_purpose"]
          requested_service_type: Database["public"]["Enums"]["transport_service_type"]
          requester_profile_id: string
          sender_is_registered_breeder: boolean | null
          sender_is_verified_org: boolean | null
          sender_org_id: string | null
          sender_profile_id: string | null
          sex: Database["public"]["Enums"]["dog_sex"] | null
          size_category: Database["public"]["Enums"]["size_category"] | null
          status: Database["public"]["Enums"]["transport_status"]
          traces_notification_required: boolean | null
          travelling_with_owner: boolean | null
          updated_at: string
          vaccination_status: string | null
          visibility: Database["public"]["Enums"]["transport_visibility"]
          weight_kg: number | null
        }
        Insert: {
          animal_id?: string | null
          animal_name?: string | null
          anxiety_or_aggression_notes?: string | null
          approximate_age?: string | null
          assigned_driver_id?: string | null
          assigned_route_id?: string | null
          assigned_vehicle_id?: string | null
          behavioural_notes?: string | null
          breed_free_text?: string | null
          can_travel_with_others?: boolean | null
          compliance_review_result?: Database["public"]["Enums"]["transport_compliance_result"]
          confirmed_accurate?: boolean
          confirmed_authority?: boolean
          confirmed_understands_publication_not_confirmation?: boolean
          confirmed_understands_review?: boolean
          confirmed_will_provide_documents?: boolean
          crate_requirements?: string | null
          created_at?: string
          current_owner_profile_id?: string | null
          delivery_type?: Database["public"]["Enums"]["transport_delivery_type"]
          destination_address_exact?: string | null
          destination_area_approx?: string | null
          destination_city?: string | null
          destination_country?: string | null
          destination_treatment_required?: boolean | null
          earliest_date?: string | null
          flexible_dates?: boolean
          has_microchip?: boolean | null
          has_passport?: boolean | null
          health_certificate_required?: boolean | null
          health_condition?: string | null
          id?: string
          is_adoption?: boolean | null
          is_domestic?: boolean | null
          is_ownership_change?: boolean | null
          is_sale?: boolean | null
          latest_date?: string | null
          medically_fit_for_transport?: boolean | null
          medication?: string | null
          microchip_known?: boolean
          microchip_number?: string | null
          number_of_animals?: number
          origin_registered_or_approved?: boolean | null
          owner_travel_within_5_days?: boolean | null
          ownership_changing?: boolean
          passport_available?: boolean | null
          payer_profile_id?: string | null
          pickup_address_exact?: string | null
          pickup_area_approx?: string | null
          pickup_city?: string | null
          pickup_country?: string | null
          rabies_vaccination_date?: string | null
          rabies_valid?: boolean | null
          receive_authorized_by?: string | null
          recipient_profile_id?: string | null
          release_authorized_by?: string | null
          request_number?: string | null
          request_purpose?: Database["public"]["Enums"]["transport_request_purpose"]
          requested_service_type?: Database["public"]["Enums"]["transport_service_type"]
          requester_profile_id: string
          sender_is_registered_breeder?: boolean | null
          sender_is_verified_org?: boolean | null
          sender_org_id?: string | null
          sender_profile_id?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          status?: Database["public"]["Enums"]["transport_status"]
          traces_notification_required?: boolean | null
          travelling_with_owner?: boolean | null
          updated_at?: string
          vaccination_status?: string | null
          visibility?: Database["public"]["Enums"]["transport_visibility"]
          weight_kg?: number | null
        }
        Update: {
          animal_id?: string | null
          animal_name?: string | null
          anxiety_or_aggression_notes?: string | null
          approximate_age?: string | null
          assigned_driver_id?: string | null
          assigned_route_id?: string | null
          assigned_vehicle_id?: string | null
          behavioural_notes?: string | null
          breed_free_text?: string | null
          can_travel_with_others?: boolean | null
          compliance_review_result?: Database["public"]["Enums"]["transport_compliance_result"]
          confirmed_accurate?: boolean
          confirmed_authority?: boolean
          confirmed_understands_publication_not_confirmation?: boolean
          confirmed_understands_review?: boolean
          confirmed_will_provide_documents?: boolean
          crate_requirements?: string | null
          created_at?: string
          current_owner_profile_id?: string | null
          delivery_type?: Database["public"]["Enums"]["transport_delivery_type"]
          destination_address_exact?: string | null
          destination_area_approx?: string | null
          destination_city?: string | null
          destination_country?: string | null
          destination_treatment_required?: boolean | null
          earliest_date?: string | null
          flexible_dates?: boolean
          has_microchip?: boolean | null
          has_passport?: boolean | null
          health_certificate_required?: boolean | null
          health_condition?: string | null
          id?: string
          is_adoption?: boolean | null
          is_domestic?: boolean | null
          is_ownership_change?: boolean | null
          is_sale?: boolean | null
          latest_date?: string | null
          medically_fit_for_transport?: boolean | null
          medication?: string | null
          microchip_known?: boolean
          microchip_number?: string | null
          number_of_animals?: number
          origin_registered_or_approved?: boolean | null
          owner_travel_within_5_days?: boolean | null
          ownership_changing?: boolean
          passport_available?: boolean | null
          payer_profile_id?: string | null
          pickup_address_exact?: string | null
          pickup_area_approx?: string | null
          pickup_city?: string | null
          pickup_country?: string | null
          rabies_vaccination_date?: string | null
          rabies_valid?: boolean | null
          receive_authorized_by?: string | null
          recipient_profile_id?: string | null
          release_authorized_by?: string | null
          request_number?: string | null
          request_purpose?: Database["public"]["Enums"]["transport_request_purpose"]
          requested_service_type?: Database["public"]["Enums"]["transport_service_type"]
          requester_profile_id?: string
          sender_is_registered_breeder?: boolean | null
          sender_is_verified_org?: boolean | null
          sender_org_id?: string | null
          sender_profile_id?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          status?: Database["public"]["Enums"]["transport_status"]
          traces_notification_required?: boolean | null
          travelling_with_owner?: boolean | null
          updated_at?: string
          vaccination_status?: string | null
          visibility?: Database["public"]["Enums"]["transport_visibility"]
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_requests_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_current_owner_profile_id_fkey"
            columns: ["current_owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_driver_fk"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_payer_profile_id_fkey"
            columns: ["payer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_route_fk"
            columns: ["assigned_route_id"]
            isOneToOne: false
            referencedRelation: "public_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_route_fk"
            columns: ["assigned_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_sender_org_id_fkey"
            columns: ["sender_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_vehicle_fk"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_reviews: {
        Row: {
          comment: string | null
          created_at: string
          driver_rating: number | null
          id: string
          rating: number
          reviewer_profile_id: string
          transport_request_id: string
          would_recommend: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_rating?: number | null
          id?: string
          rating: number
          reviewer_profile_id: string
          transport_request_id: string
          would_recommend?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_rating?: number | null
          id?: string
          rating?: number
          reviewer_profile_id?: string
          transport_request_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_reviews_reviewer_profile_id_fkey"
            columns: ["reviewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_reviews_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: true
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_reviews_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: true
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_reviews_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: true
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          customer_note: string | null
          evidence_url: string | null
          id: string
          internal_note: string | null
          status: Database["public"]["Enums"]["transport_status"]
          transport_request_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          customer_note?: string | null
          evidence_url?: string | null
          id?: string
          internal_note?: string | null
          status: Database["public"]["Enums"]["transport_status"]
          transport_request_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          customer_note?: string | null
          evidence_url?: string | null
          id?: string
          internal_note?: string | null
          status?: Database["public"]["Enums"]["transport_status"]
          transport_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_status_history_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_status_history_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_status_history_transport_request_id_fkey"
            columns: ["transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          consented_at: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          id: string
          profile_id: string
          version: string
        }
        Insert: {
          consented_at?: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          id?: string
          profile_id: string
          version: string
        }
        Update: {
          consented_at?: string
          document_type?: Database["public"]["Enums"]["legal_document_type"]
          id?: string
          profile_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          status: Database["public"]["Enums"]["role_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          status?: Database["public"]["Enums"]["role_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          status?: Database["public"]["Enums"]["role_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_verifications: {
        Row: {
          created_at: string
          evidence_url: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_data: Json
          updated_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Insert: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_data?: Json
          updated_at?: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Update: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_data?: Json
          updated_at?: string
          user_id?: string
          verification_type?: Database["public"]["Enums"]["verification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "user_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          authorisation_notes: string | null
          camera_available: boolean
          cleaning_status: string | null
          country_of_registration: string | null
          crates: Json
          created_at: string
          document_expiry_date: string | null
          id: string
          insurance_expiry_date: string | null
          internal_notes: string | null
          last_cleaning_date: string | null
          last_service_date: string | null
          make: string | null
          model: string | null
          name: string
          next_service_date: string | null
          registration_number: string | null
          temperature_monitoring: boolean
          vehicle_type: string | null
          ventilation_info: string | null
          year: number | null
        }
        Insert: {
          active?: boolean
          authorisation_notes?: string | null
          camera_available?: boolean
          cleaning_status?: string | null
          country_of_registration?: string | null
          crates?: Json
          created_at?: string
          document_expiry_date?: string | null
          id?: string
          insurance_expiry_date?: string | null
          internal_notes?: string | null
          last_cleaning_date?: string | null
          last_service_date?: string | null
          make?: string | null
          model?: string | null
          name: string
          next_service_date?: string | null
          registration_number?: string | null
          temperature_monitoring?: boolean
          vehicle_type?: string | null
          ventilation_info?: string | null
          year?: number | null
        }
        Update: {
          active?: boolean
          authorisation_notes?: string | null
          camera_available?: boolean
          cleaning_status?: string | null
          country_of_registration?: string | null
          crates?: Json
          created_at?: string
          document_expiry_date?: string | null
          id?: string
          insurance_expiry_date?: string | null
          internal_notes?: string | null
          last_cleaning_date?: string | null
          last_service_date?: string | null
          make?: string | null
          model?: string | null
          name?: string
          next_service_date?: string | null
          registration_number?: string | null
          temperature_monitoring?: boolean
          vehicle_type?: string | null
          ventilation_info?: string | null
          year?: number | null
        }
        Relationships: []
      }
      welfare_case_documents: {
        Row: {
          created_at: string
          file_url: string
          id: string
          notes: string | null
          uploaded_by: string | null
          welfare_case_id: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          notes?: string | null
          uploaded_by?: string | null
          welfare_case_id: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          notes?: string | null
          uploaded_by?: string | null
          welfare_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "welfare_case_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_case_documents_welfare_case_id_fkey"
            columns: ["welfare_case_id"]
            isOneToOne: false
            referencedRelation: "welfare_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      welfare_cases: {
        Row: {
          animal_description: string | null
          animal_id: string | null
          animal_name: string | null
          case_number: string | null
          contact_name: string | null
          contact_phone: string | null
          converted_transport_request_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          destination_city: string | null
          destination_country: string | null
          id: string
          location_address_exact: string | null
          location_area_approx: string | null
          location_city: string | null
          location_country: string | null
          ops_acknowledged: boolean
          ops_acknowledged_at: string | null
          ops_acknowledged_by: string | null
          organisation_id: string
          reason: string
          review_notes: string | null
          status: Database["public"]["Enums"]["welfare_case_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["welfare_case_urgency"]
          welfare_notes: string | null
        }
        Insert: {
          animal_description?: string | null
          animal_id?: string | null
          animal_name?: string | null
          case_number?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_transport_request_id?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          destination_city?: string | null
          destination_country?: string | null
          id?: string
          location_address_exact?: string | null
          location_area_approx?: string | null
          location_city?: string | null
          location_country?: string | null
          ops_acknowledged?: boolean
          ops_acknowledged_at?: string | null
          ops_acknowledged_by?: string | null
          organisation_id: string
          reason: string
          review_notes?: string | null
          status?: Database["public"]["Enums"]["welfare_case_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["welfare_case_urgency"]
          welfare_notes?: string | null
        }
        Update: {
          animal_description?: string | null
          animal_id?: string | null
          animal_name?: string | null
          case_number?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_transport_request_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          destination_city?: string | null
          destination_country?: string | null
          id?: string
          location_address_exact?: string | null
          location_area_approx?: string | null
          location_city?: string | null
          location_country?: string | null
          ops_acknowledged?: boolean
          ops_acknowledged_at?: string | null
          ops_acknowledged_by?: string | null
          organisation_id?: string
          reason?: string
          review_notes?: string | null
          status?: Database["public"]["Enums"]["welfare_case_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["welfare_case_urgency"]
          welfare_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welfare_cases_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_cases_converted_transport_request_id_fkey"
            columns: ["converted_transport_request_id"]
            isOneToOne: false
            referencedRelation: "driver_transport_job_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_cases_converted_transport_request_id_fkey"
            columns: ["converted_transport_request_id"]
            isOneToOne: false
            referencedRelation: "public_transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_cases_converted_transport_request_id_fkey"
            columns: ["converted_transport_request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_cases_ops_acknowledged_by_fkey"
            columns: ["ops_acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welfare_cases_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      driver_transport_job_view: {
        Row: {
          animal_name: string | null
          anxiety_or_aggression_notes: string | null
          assigned_driver_id: string | null
          assigned_route_id: string | null
          assigned_vehicle_id: string | null
          behavioural_notes: string | null
          breed_free_text: string | null
          can_travel_with_others: boolean | null
          crate_requirements: string | null
          delivery_type:
            | Database["public"]["Enums"]["transport_delivery_type"]
            | null
          destination_address_exact: string | null
          destination_area_approx: string | null
          destination_city: string | null
          destination_country: string | null
          earliest_date: string | null
          flexible_dates: boolean | null
          id: string | null
          latest_date: string | null
          pickup_address_exact: string | null
          pickup_area_approx: string | null
          pickup_city: string | null
          pickup_country: string | null
          receive_authorized_by: string | null
          release_authorized_by: string | null
          request_number: string | null
          sex: Database["public"]["Enums"]["dog_sex"] | null
          size_category: Database["public"]["Enums"]["size_category"] | null
          status: Database["public"]["Enums"]["transport_status"] | null
          weight_kg: number | null
        }
        Insert: {
          animal_name?: string | null
          anxiety_or_aggression_notes?: string | null
          assigned_driver_id?: string | null
          assigned_route_id?: string | null
          assigned_vehicle_id?: string | null
          behavioural_notes?: string | null
          breed_free_text?: string | null
          can_travel_with_others?: boolean | null
          crate_requirements?: string | null
          delivery_type?:
            | Database["public"]["Enums"]["transport_delivery_type"]
            | null
          destination_address_exact?: string | null
          destination_area_approx?: string | null
          destination_city?: string | null
          destination_country?: string | null
          earliest_date?: string | null
          flexible_dates?: boolean | null
          id?: string | null
          latest_date?: string | null
          pickup_address_exact?: string | null
          pickup_area_approx?: string | null
          pickup_city?: string | null
          pickup_country?: string | null
          receive_authorized_by?: string | null
          release_authorized_by?: string | null
          request_number?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          status?: Database["public"]["Enums"]["transport_status"] | null
          weight_kg?: number | null
        }
        Update: {
          animal_name?: string | null
          anxiety_or_aggression_notes?: string | null
          assigned_driver_id?: string | null
          assigned_route_id?: string | null
          assigned_vehicle_id?: string | null
          behavioural_notes?: string | null
          breed_free_text?: string | null
          can_travel_with_others?: boolean | null
          crate_requirements?: string | null
          delivery_type?:
            | Database["public"]["Enums"]["transport_delivery_type"]
            | null
          destination_address_exact?: string | null
          destination_area_approx?: string | null
          destination_city?: string | null
          destination_country?: string | null
          earliest_date?: string | null
          flexible_dates?: boolean | null
          id?: string | null
          latest_date?: string | null
          pickup_address_exact?: string | null
          pickup_area_approx?: string | null
          pickup_city?: string | null
          pickup_country?: string | null
          receive_authorized_by?: string | null
          release_authorized_by?: string | null
          request_number?: string | null
          sex?: Database["public"]["Enums"]["dog_sex"] | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          status?: Database["public"]["Enums"]["transport_status"] | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_requests_driver_fk"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_route_fk"
            columns: ["assigned_route_id"]
            isOneToOne: false
            referencedRelation: "public_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_route_fk"
            columns: ["assigned_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_vehicle_fk"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      my_moderation_case_view: {
        Row: {
          appeal_deadline: string | null
          appeal_status: Database["public"]["Enums"]["appeal_status"] | null
          case_type: string | null
          created_at: string | null
          id: string | null
          public_decision_summary: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["moderation_case_status"] | null
          target_type: Database["public"]["Enums"]["report_target_type"] | null
        }
        Insert: {
          appeal_deadline?: string | null
          appeal_status?: Database["public"]["Enums"]["appeal_status"] | null
          case_type?: string | null
          created_at?: string | null
          id?: string | null
          public_decision_summary?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"] | null
          target_type?: Database["public"]["Enums"]["report_target_type"] | null
        }
        Update: {
          appeal_deadline?: string | null
          appeal_status?: Database["public"]["Enums"]["appeal_status"] | null
          case_type?: string | null
          created_at?: string | null
          id?: string | null
          public_decision_summary?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["moderation_case_status"] | null
          target_type?: Database["public"]["Enums"]["report_target_type"] | null
        }
        Relationships: []
      }
      public_fundraising_contributions: {
        Row: {
          amount: number | null
          campaign_id: string | null
          created_at: string | null
          currency: string | null
          id: string | null
          public_message: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fundraising_contributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fundraising_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fundraising_contributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "public_fundraising_totals"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      public_fundraising_totals: {
        Row: {
          campaign_id: string | null
          total_collected: number | null
        }
        Relationships: []
      }
      public_routes: {
        Row: {
          available_capacity: number | null
          departure_date: string | null
          destination_countries: string[] | null
          destination_regions: string[] | null
          id: string | null
          max_capacity: number | null
          origin_country: string | null
          origin_region: string | null
          route_name: string | null
          route_number: string | null
          status: Database["public"]["Enums"]["route_status"] | null
        }
        Relationships: []
      }
      public_transport_rating: {
        Row: {
          average_rating: number | null
          review_count: number | null
        }
        Relationships: []
      }
      public_transport_requests: {
        Row: {
          breed_free_text: string | null
          created_at: string | null
          destination_area_approx: string | null
          destination_country: string | null
          earliest_date: string | null
          flexible_dates: boolean | null
          id: string | null
          latest_date: string | null
          pickup_area_approx: string | null
          pickup_country: string | null
          request_number: string | null
          request_purpose:
            | Database["public"]["Enums"]["transport_request_purpose"]
            | null
          requested_service_type:
            | Database["public"]["Enums"]["transport_service_type"]
            | null
          size_category: Database["public"]["Enums"]["size_category"] | null
          status: Database["public"]["Enums"]["transport_status"] | null
        }
        Insert: {
          breed_free_text?: string | null
          created_at?: string | null
          destination_area_approx?: string | null
          destination_country?: string | null
          earliest_date?: string | null
          flexible_dates?: boolean | null
          id?: string | null
          latest_date?: string | null
          pickup_area_approx?: string | null
          pickup_country?: string | null
          request_number?: string | null
          request_purpose?:
            | Database["public"]["Enums"]["transport_request_purpose"]
            | null
          requested_service_type?:
            | Database["public"]["Enums"]["transport_service_type"]
            | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          status?: Database["public"]["Enums"]["transport_status"] | null
        }
        Update: {
          breed_free_text?: string | null
          created_at?: string | null
          destination_area_approx?: string | null
          destination_country?: string | null
          earliest_date?: string | null
          flexible_dates?: boolean | null
          id?: string | null
          latest_date?: string | null
          pickup_area_approx?: string | null
          pickup_country?: string | null
          request_number?: string | null
          request_purpose?:
            | Database["public"]["Enums"]["transport_request_purpose"]
            | null
          requested_service_type?:
            | Database["public"]["Enums"]["transport_service_type"]
            | null
          size_category?: Database["public"]["Enums"]["size_category"] | null
          status?: Database["public"]["Enums"]["transport_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_org_invitation: { Args: { p_token: string }; Returns: undefined }
      acknowledge_welfare_case: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      advance_transport_job_status: {
        Args: {
          p_customer_note?: string
          p_evidence_object_path?: string
          p_new_status: Database["public"]["Enums"]["transport_status"]
          p_request_id: string
        }
        Returns: undefined
      }
      animal_has_approved_rehoming: {
        Args: { p_animal_id: string }
        Returns: boolean
      }
      approve_rehoming_review: {
        Args: { p_review_id: string }
        Returns: undefined
      }
      approve_user_verification: {
        Args: { p_admin_notes?: string; p_verification_id: string }
        Returns: string
      }
      assign_driver_to_job: {
        Args: { p_driver_id: string; p_transport_request_id: string }
        Returns: undefined
      }
      assign_request_to_route: {
        Args: {
          p_compatibility_notes?: string
          p_route_id: string
          p_transport_request_id: string
        }
        Returns: string
      }
      can_manage_org_members: { Args: { p_org_id: string }; Returns: boolean }
      can_reference_animal_for_transport: {
        Args: { p_animal_id: string }
        Returns: boolean
      }
      can_view_post: { Args: { p_post_id: string }; Returns: boolean }
      change_ops_request_status: {
        Args: {
          p_customer_note?: string
          p_internal_note?: string
          p_new_status: Database["public"]["Enums"]["transport_status"]
          p_request_id: string
        }
        Returns: undefined
      }
      change_org_member_role: {
        Args: {
          p_member_id: string
          p_new_role: Database["public"]["Enums"]["org_member_role"]
        }
        Returns: undefined
      }
      claim_moderation_case: { Args: { p_case_id: string }; Returns: undefined }
      claim_support_case: { Args: { p_case_id: string }; Returns: undefined }
      convert_application_to_reservation: {
        Args: {
          p_agreed_price?: number
          p_application_id: string
          p_collection_method?: Database["public"]["Enums"]["collection_method"]
          p_currency?: string
          p_notes?: string
          p_planned_collection_date?: string
        }
        Returns: string
      }
      convert_welfare_case_to_transport_draft: {
        Args: { p_case_id: string }
        Returns: string
      }
      create_notification_if_enabled: {
        Args: {
          p_body?: string
          p_category: string
          p_dedup_key?: string
          p_link_url?: string
          p_notification_type: string
          p_profile_id: string
          p_template_version?: number
          p_title: string
        }
        Returns: string
      }
      create_transport_draft: {
        Args: { p_animals?: Json; p_parties?: Json; p_request: Json }
        Returns: string
      }
      decline_org_invitation: { Args: { p_token: string }; Returns: undefined }
      enforce_rate_limit: {
        Args: { p_action_key: string; p_max_count: number; p_window: string }
        Returns: undefined
      }
      escalate_report_to_case: {
        Args: { p_report_id: string }
        Returns: string
      }
      execute_account_deletion: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      fundraising_campaign_links_are_valid: {
        Args: {
          p_animal_id: string
          p_buyer_application_id: string
          p_organisation_id: string
          p_quotation_id: string
          p_transport_request_id: string
        }
        Returns: boolean
      }
      get_account_deletion_blockers: {
        Args: { p_profile_id: string }
        Returns: {
          blocker: string
        }[]
      }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          invited_role: Database["public"]["Enums"]["org_member_role"]
          org_name: string
          org_type: Database["public"]["Enums"]["org_type"]
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          is_deleted: boolean
          last_name: string | null
          phone: string | null
          preferred_currency: string
          preferred_language: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_notification_preference: {
        Args: { p_category: string; p_profile_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          p_role: Database["public"]["Enums"]["platform_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      invite_org_member: {
        Args: {
          p_email: string
          p_org_id: string
          p_role: Database["public"]["Enums"]["org_member_role"]
        }
        Returns: string
      }
      is_active_driver: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_driver_for_request: {
        Args: { p_transport_request_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_eligible_fundraising_org: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      is_following_target: {
        Args: {
          p_followed_organization_id: string
          p_followed_profile_id: string
        }
        Returns: boolean
      }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      is_my_driver_id: { Args: { p_driver_id: string }; Returns: boolean }
      is_named_transport_party: {
        Args: { p_transport_request_id: string }
        Returns: boolean
      }
      is_ops_staff: { Args: never; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_profile_under_legal_hold: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      last_auth_at: { Args: never; Returns: string }
      leave_organisation: { Args: { p_org_id: string }; Returns: undefined }
      mark_risk_signal_reviewed: {
        Args: {
          p_is_false_positive: boolean
          p_resolution_notes?: string
          p_signal_id: string
        }
        Returns: undefined
      }
      owner_role_for_org_type: {
        Args: { p_org_type: Database["public"]["Enums"]["org_type"] }
        Returns: Database["public"]["Enums"]["platform_role"]
      }
      owns_animal: { Args: { p_animal_id: string }; Returns: boolean }
      owns_org: { Args: { p_org_id: string }; Returns: boolean }
      place_legal_hold: {
        Args: { p_reason: string; p_subject_profile_id: string }
        Returns: string
      }
      record_risk_signal: {
        Args: {
          p_explanation: string
          p_rule_version: string
          p_signal_type: Database["public"]["Enums"]["risk_signal_type"]
          p_source_event_type: string
          p_subject_profile_id: string
        }
        Returns: undefined
      }
      release_legal_hold: {
        Args: { p_hold_id: string; p_release_reason?: string }
        Returns: undefined
      }
      remove_org_member: { Args: { p_member_id: string }; Returns: undefined }
      request_transport_amendment: {
        Args: {
          p_field_name: string
          p_new_value: string
          p_transport_request_id: string
        }
        Returns: string
      }
      require_recent_auth: {
        Args: { p_max_age?: string; p_operation: string }
        Returns: undefined
      }
      respond_to_quotation: {
        Args: {
          p_quotation_id: string
          p_response: Database["public"]["Enums"]["quotation_status"]
        }
        Returns: undefined
      }
      review_moderation_appeal: {
        Args: {
          p_appeal_id: string
          p_decision: Database["public"]["Enums"]["moderation_appeal_status"]
          p_internal_notes?: string
          p_outcome_notes?: string
        }
        Returns: undefined
      }
      review_transport_amendment: {
        Args: {
          p_amendment_id: string
          p_approve: boolean
          p_review_note?: string
        }
        Returns: undefined
      }
      review_welfare_case: {
        Args: {
          p_case_id: string
          p_decision: Database["public"]["Enums"]["welfare_case_status"]
          p_review_notes?: string
        }
        Returns: undefined
      }
      revoke_org_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      send_quotation: { Args: { p_quotation_id: string }; Returns: undefined }
      set_org_member_status: {
        Args: {
          p_member_id: string
          p_status: Database["public"]["Enums"]["org_member_status"]
        }
        Returns: undefined
      }
      start_application_conversation: {
        Args: { p_animal_id: string; p_buyer_id?: string }
        Returns: string
      }
      start_transport_conversation: {
        Args: { p_transport_request_id: string }
        Returns: string
      }
      submit_moderation_appeal: {
        Args: {
          p_case_id: string
          p_statement: string
          p_supporting_document_url?: string
        }
        Returns: string
      }
      submit_transport_request: {
        Args: { p_draft_id?: string; p_request: Json }
        Returns: {
          id: string
          request_number: string
          status: Database["public"]["Enums"]["transport_status"]
        }[]
      }
    }
    Enums: {
      account_deletion_status: "pending" | "processed" | "declined"
      achievement_verification_status: "pending" | "approved" | "rejected"
      agreement_status: "not_sent" | "sent" | "signed"
      animal_availability_status:
        | "draft"
        | "applications_open"
        | "available"
        | "reserved"
        | "sold"
        | "adopted"
        | "unavailable"
        | "withdrawn"
      animal_listing_category:
        | "breeder_puppy"
        | "adoption"
        | "private_rehoming"
        | "not_listed"
      appeal_status: "none" | "requested" | "reviewed"
      application_type: "purchase" | "adoption" | "rehoming_inquiry"
      buyer_application_status:
        | "submitted"
        | "under_review"
        | "more_info_requested"
        | "call_requested"
        | "waiting_list"
        | "approved"
        | "rejected"
        | "withdrawn"
        | "converted_to_reservation"
        | "draft"
        | "interview_planned"
        | "expired"
      collection_method:
        | "pickup"
        | "domestic_transport"
        | "international_transport"
      content_moderation_status: "visible" | "hidden" | "removed"
      conversation_participant_role:
        | "requester"
        | "ops"
        | "buyer"
        | "breeder"
        | "adopter"
        | "foundation"
        | "sender"
        | "recipient"
        | "member"
      conversation_type:
        | "transport"
        | "marketplace"
        | "adoption"
        | "community"
        | "support"
      deposit_status: "not_required" | "pending" | "paid"
      dog_sex: "male" | "female"
      driver_verification_status:
        | "unverified"
        | "documents_submitted"
        | "verified"
      fundraising_campaign_status:
        | "draft"
        | "organisation_review"
        | "approved"
        | "active"
        | "target_reached"
        | "partially_funded"
        | "expired"
        | "transport_cancelled"
        | "suspended"
        | "completed"
        | "refund_review"
      fundraising_payment_status:
        | "pending"
        | "completed"
        | "failed"
        | "refunded"
      group_member_role: "member" | "moderator"
      handover_type: "pickup" | "delivery"
      housing_type: "house" | "apartment"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status: "open" | "investigating" | "resolved"
      incident_type:
        | "delay"
        | "vehicle_breakdown"
        | "animal_welfare_concern"
        | "accident"
        | "document_issue"
        | "weather"
        | "other"
      kennel_contact_mode: "anemalo" | "external" | "both"
      kennel_section:
        | "about"
        | "gallery"
        | "posts"
        | "dogs"
        | "litters"
        | "planned_litters"
        | "listings"
        | "pedigrees"
        | "health"
        | "achievements"
        | "reviews"
        | "transport"
        | "contact"
      kennel_theme: "classic" | "editorial" | "modern"
      legal_document_type: "terms" | "privacy" | "cookies"
      legal_requirement_category:
        | "transport"
        | "breeding"
        | "sales"
        | "import_export"
        | "identification"
        | "other"
      legal_requirement_enforcement: "advisory" | "blocking"
      litter_status:
        | "planned"
        | "born"
        | "applications_open"
        | "fully_reserved"
        | "completed"
        | "cancelled"
      market_state:
        | "unavailable"
        | "discovery_only"
        | "listings_available"
        | "adoption_available"
        | "transport_requests_available"
        | "partner_transport"
        | "full_anemalo_service"
      message_kind:
        | "customer_info"
        | "document_request"
        | "quotation"
        | "scheduling_update"
        | "internal_note"
        | "handover_instruction"
        | "general"
      moderation_appeal_status:
        | "submitted"
        | "under_review"
        | "upheld"
        | "overturned"
      moderation_case_status:
        | "open"
        | "investigating"
        | "resolved"
        | "dismissed"
      operator_authorisation_status: "active" | "expired" | "pending"
      operator_authorisation_type:
        | "type_1"
        | "type_2"
        | "other"
        | "not_yet_approved"
        | "awaiting_renewal"
      org_invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "revoked"
        | "expired"
      org_member_role:
        | "owner"
        | "administrator"
        | "employee"
        | "breeder"
        | "volunteer"
        | "driver"
        | "viewer"
        | "adoption_coordinator"
        | "transport_coordinator"
        | "animal_care_member"
      org_member_status: "active" | "suspended"
      org_type:
        | "kennel"
        | "foundation"
        | "shelter"
        | "rescue"
        | "transport_company"
        | "kennel_club"
        | "other"
      org_verification_status: "pending" | "approved" | "rejected" | "suspended"
      organisation_domain_status:
        | "pending"
        | "verifying"
        | "active"
        | "failed"
        | "disabled"
      organisation_domain_type: "anemalo_subdomain" | "custom_domain"
      platform_role:
        | "customer"
        | "buyer"
        | "animal_owner"
        | "breeder"
        | "foundation_member"
        | "shelter_member"
        | "operations"
        | "driver"
        | "moderator"
        | "admin"
      post_media_type: "image" | "video"
      post_type:
        | "general"
        | "transport_update"
        | "route_announcement"
        | "litter_announcement"
        | "adoption_post"
        | "achievement"
        | "photo"
        | "video"
        | "health_update"
        | "dog_update"
        | "planned_mating"
        | "availability_announcement"
        | "transport_availability"
        | "educational"
        | "registry_announcement"
      post_visibility:
        | "public"
        | "followers"
        | "group"
        | "private"
        | "litter_members"
      pricing_rule_type:
        | "base_fee"
        | "distance_band"
        | "size_multiplier"
        | "service_multiplier"
        | "additional_stop"
        | "waiting_time"
        | "special_crate"
        | "urgent_planning"
        | "document_handling"
        | "country_surcharge"
        | "ferry_or_toll_placeholder"
        | "manual_adjustment"
      product_service_category_group: "physical_product" | "service"
      quotation_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
        | "replaced"
      reaction_type: "like" | "support" | "helpful"
      rehoming_admin_status: "pending" | "approved" | "rejected"
      report_reason:
        | "suspected_illegal_breeding"
        | "false_breeder_information"
        | "stolen_animal"
        | "missing_or_false_microchip"
        | "animal_welfare_concern"
        | "misleading_health_information"
        | "scam_or_payment_fraud"
        | "duplicate_listing"
        | "prohibited_content"
        | "other"
      report_status: "open" | "dismissed" | "escalated"
      report_target_type:
        | "animal_listing"
        | "organisation"
        | "post"
        | "message"
        | "user"
      reservation_status:
        | "awaiting_buyer"
        | "awaiting_breeder"
        | "confirmed"
        | "cancelled"
        | "completed"
      risk_signal_type:
        | "repeated_rate_limit_hits"
        | "repeated_moderation_submission_failures"
        | "repeated_duplicate_applications"
        | "repeated_document_rejections"
        | "multiple_independent_reports"
        | "repeated_idempotency_conflicts"
        | "invitation_burst"
        | "repeated_ownership_transfer_failures"
        | "possible_duplicate_transport_request"
      role_status: "pending" | "active" | "suspended" | "rejected"
      route_reservation_status:
        | "temporarily_held"
        | "waiting_for_customer_action"
        | "confirmed"
        | "expired"
        | "released"
        | "cancelled"
      route_status:
        | "planning"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      route_stop_type: "pickup" | "dropoff" | "rest"
      route_waitlist_status: "open" | "matched" | "cancelled"
      size_category: "small" | "medium" | "large" | "giant"
      species_key:
        | "dog"
        | "cat"
        | "rabbit"
        | "guinea_pig"
        | "other_small_mammal"
        | "bird"
        | "reptile_amphibian"
        | "fish"
        | "exotic"
        | "horse"
      support_case_priority: "low" | "medium" | "high" | "urgent"
      support_case_status:
        | "open"
        | "triaged"
        | "in_progress"
        | "waiting_for_customer"
        | "waiting_for_internal"
        | "resolved"
        | "closed"
        | "reopened"
      transport_amendment_status: "pending" | "approved" | "rejected"
      transport_compliance_result:
        | "basic_review_required"
        | "documents_missing"
        | "veterinary_review_required"
        | "international_commercial_review"
        | "eligible_for_quotation"
        | "not_currently_eligible"
        | "manually_approved"
      transport_delivery_type: "home_delivery" | "meeting_point"
      transport_document_category:
        | "passport"
        | "microchip_confirmation"
        | "vaccination_information"
        | "rabies_vaccination"
        | "health_certificate"
        | "veterinary_examination"
        | "traces_reference"
        | "breeder_documentation"
        | "foundation_documentation"
        | "ownership_declaration"
        | "sale_agreement"
        | "adoption_agreement"
        | "transport_authorisation"
        | "pickup_authorisation"
        | "handover_protocol"
        | "other"
      transport_document_status:
        | "missing"
        | "uploaded"
        | "under_review"
        | "accepted"
        | "rejected"
        | "expired"
        | "not_applicable"
      transport_party_role:
        | "legal_owner"
        | "requester"
        | "sender"
        | "recipient"
        | "payer"
        | "pickup_contact"
        | "delivery_contact"
      transport_request_purpose:
        | "own_dog"
        | "purchased_puppy"
        | "planned_sale"
        | "adoption"
        | "foundation_rescue"
        | "relocation"
        | "exhibition"
        | "veterinary"
        | "other"
      transport_service_type:
        | "shared"
        | "individual"
        | "express"
        | "vip"
        | "recommend_best"
      transport_status:
        | "draft"
        | "submitted"
        | "initial_review"
        | "missing_information"
        | "documents_under_review"
        | "quotation_prepared"
        | "quotation_sent"
        | "accepted_by_customer"
        | "awaiting_documents"
        | "ready_for_scheduling"
        | "scheduled"
        | "driver_assigned"
        | "pickup_confirmed"
        | "animal_collected"
        | "in_transport"
        | "rest_or_care_stop"
        | "approaching_destination"
        | "delivered"
        | "handover_confirmed"
        | "completed"
        | "rejected"
        | "cancelled_by_customer"
        | "cancelled_by_operations"
        | "veterinary_hold"
        | "compliance_hold"
        | "route_postponed"
      transport_visibility: "private" | "community_visible"
      verification_status:
        | "not_started"
        | "pending"
        | "more_information_required"
        | "approved"
        | "rejected"
        | "expired"
        | "suspended"
      verification_type:
        | "email"
        | "phone"
        | "identity"
        | "breeder"
        | "organisation"
        | "animal_ownership"
        | "driver"
        | "transport_employee"
      welfare_case_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "information_required"
        | "accepted_for_assessment"
        | "declined"
        | "converted_to_transport"
        | "closed"
      welfare_case_urgency: "routine" | "urgent" | "critical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_deletion_status: ["pending", "processed", "declined"],
      achievement_verification_status: ["pending", "approved", "rejected"],
      agreement_status: ["not_sent", "sent", "signed"],
      animal_availability_status: [
        "draft",
        "applications_open",
        "available",
        "reserved",
        "sold",
        "adopted",
        "unavailable",
        "withdrawn",
      ],
      animal_listing_category: [
        "breeder_puppy",
        "adoption",
        "private_rehoming",
        "not_listed",
      ],
      appeal_status: ["none", "requested", "reviewed"],
      application_type: ["purchase", "adoption", "rehoming_inquiry"],
      buyer_application_status: [
        "submitted",
        "under_review",
        "more_info_requested",
        "call_requested",
        "waiting_list",
        "approved",
        "rejected",
        "withdrawn",
        "converted_to_reservation",
        "draft",
        "interview_planned",
        "expired",
      ],
      collection_method: [
        "pickup",
        "domestic_transport",
        "international_transport",
      ],
      content_moderation_status: ["visible", "hidden", "removed"],
      conversation_participant_role: [
        "requester",
        "ops",
        "buyer",
        "breeder",
        "adopter",
        "foundation",
        "sender",
        "recipient",
        "member",
      ],
      conversation_type: [
        "transport",
        "marketplace",
        "adoption",
        "community",
        "support",
      ],
      deposit_status: ["not_required", "pending", "paid"],
      dog_sex: ["male", "female"],
      driver_verification_status: [
        "unverified",
        "documents_submitted",
        "verified",
      ],
      fundraising_campaign_status: [
        "draft",
        "organisation_review",
        "approved",
        "active",
        "target_reached",
        "partially_funded",
        "expired",
        "transport_cancelled",
        "suspended",
        "completed",
        "refund_review",
      ],
      fundraising_payment_status: [
        "pending",
        "completed",
        "failed",
        "refunded",
      ],
      group_member_role: ["member", "moderator"],
      handover_type: ["pickup", "delivery"],
      housing_type: ["house", "apartment"],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: ["open", "investigating", "resolved"],
      incident_type: [
        "delay",
        "vehicle_breakdown",
        "animal_welfare_concern",
        "accident",
        "document_issue",
        "weather",
        "other",
      ],
      kennel_contact_mode: ["anemalo", "external", "both"],
      kennel_section: [
        "about",
        "gallery",
        "posts",
        "dogs",
        "litters",
        "planned_litters",
        "listings",
        "pedigrees",
        "health",
        "achievements",
        "reviews",
        "transport",
        "contact",
      ],
      kennel_theme: ["classic", "editorial", "modern"],
      legal_document_type: ["terms", "privacy", "cookies"],
      legal_requirement_category: [
        "transport",
        "breeding",
        "sales",
        "import_export",
        "identification",
        "other",
      ],
      legal_requirement_enforcement: ["advisory", "blocking"],
      litter_status: [
        "planned",
        "born",
        "applications_open",
        "fully_reserved",
        "completed",
        "cancelled",
      ],
      market_state: [
        "unavailable",
        "discovery_only",
        "listings_available",
        "adoption_available",
        "transport_requests_available",
        "partner_transport",
        "full_anemalo_service",
      ],
      message_kind: [
        "customer_info",
        "document_request",
        "quotation",
        "scheduling_update",
        "internal_note",
        "handover_instruction",
        "general",
      ],
      moderation_appeal_status: [
        "submitted",
        "under_review",
        "upheld",
        "overturned",
      ],
      moderation_case_status: [
        "open",
        "investigating",
        "resolved",
        "dismissed",
      ],
      operator_authorisation_status: ["active", "expired", "pending"],
      operator_authorisation_type: [
        "type_1",
        "type_2",
        "other",
        "not_yet_approved",
        "awaiting_renewal",
      ],
      org_invitation_status: [
        "pending",
        "accepted",
        "declined",
        "revoked",
        "expired",
      ],
      org_member_role: [
        "owner",
        "administrator",
        "employee",
        "breeder",
        "volunteer",
        "driver",
        "viewer",
        "adoption_coordinator",
        "transport_coordinator",
        "animal_care_member",
      ],
      org_member_status: ["active", "suspended"],
      org_type: [
        "kennel",
        "foundation",
        "shelter",
        "rescue",
        "transport_company",
        "kennel_club",
        "other",
      ],
      org_verification_status: ["pending", "approved", "rejected", "suspended"],
      organisation_domain_status: [
        "pending",
        "verifying",
        "active",
        "failed",
        "disabled",
      ],
      organisation_domain_type: ["anemalo_subdomain", "custom_domain"],
      platform_role: [
        "customer",
        "buyer",
        "animal_owner",
        "breeder",
        "foundation_member",
        "shelter_member",
        "operations",
        "driver",
        "moderator",
        "admin",
      ],
      post_media_type: ["image", "video"],
      post_type: [
        "general",
        "transport_update",
        "route_announcement",
        "litter_announcement",
        "adoption_post",
        "achievement",
        "photo",
        "video",
        "health_update",
        "dog_update",
        "planned_mating",
        "availability_announcement",
        "transport_availability",
        "educational",
        "registry_announcement",
      ],
      post_visibility: [
        "public",
        "followers",
        "group",
        "private",
        "litter_members",
      ],
      pricing_rule_type: [
        "base_fee",
        "distance_band",
        "size_multiplier",
        "service_multiplier",
        "additional_stop",
        "waiting_time",
        "special_crate",
        "urgent_planning",
        "document_handling",
        "country_surcharge",
        "ferry_or_toll_placeholder",
        "manual_adjustment",
      ],
      product_service_category_group: ["physical_product", "service"],
      quotation_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "replaced",
      ],
      reaction_type: ["like", "support", "helpful"],
      rehoming_admin_status: ["pending", "approved", "rejected"],
      report_reason: [
        "suspected_illegal_breeding",
        "false_breeder_information",
        "stolen_animal",
        "missing_or_false_microchip",
        "animal_welfare_concern",
        "misleading_health_information",
        "scam_or_payment_fraud",
        "duplicate_listing",
        "prohibited_content",
        "other",
      ],
      report_status: ["open", "dismissed", "escalated"],
      report_target_type: [
        "animal_listing",
        "organisation",
        "post",
        "message",
        "user",
      ],
      reservation_status: [
        "awaiting_buyer",
        "awaiting_breeder",
        "confirmed",
        "cancelled",
        "completed",
      ],
      risk_signal_type: [
        "repeated_rate_limit_hits",
        "repeated_moderation_submission_failures",
        "repeated_duplicate_applications",
        "repeated_document_rejections",
        "multiple_independent_reports",
        "repeated_idempotency_conflicts",
        "invitation_burst",
        "repeated_ownership_transfer_failures",
        "possible_duplicate_transport_request",
      ],
      role_status: ["pending", "active", "suspended", "rejected"],
      route_reservation_status: [
        "temporarily_held",
        "waiting_for_customer_action",
        "confirmed",
        "expired",
        "released",
        "cancelled",
      ],
      route_status: [
        "planning",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      route_stop_type: ["pickup", "dropoff", "rest"],
      route_waitlist_status: ["open", "matched", "cancelled"],
      size_category: ["small", "medium", "large", "giant"],
      species_key: [
        "dog",
        "cat",
        "rabbit",
        "guinea_pig",
        "other_small_mammal",
        "bird",
        "reptile_amphibian",
        "fish",
        "exotic",
        "horse",
      ],
      support_case_priority: ["low", "medium", "high", "urgent"],
      support_case_status: [
        "open",
        "triaged",
        "in_progress",
        "waiting_for_customer",
        "waiting_for_internal",
        "resolved",
        "closed",
        "reopened",
      ],
      transport_amendment_status: ["pending", "approved", "rejected"],
      transport_compliance_result: [
        "basic_review_required",
        "documents_missing",
        "veterinary_review_required",
        "international_commercial_review",
        "eligible_for_quotation",
        "not_currently_eligible",
        "manually_approved",
      ],
      transport_delivery_type: ["home_delivery", "meeting_point"],
      transport_document_category: [
        "passport",
        "microchip_confirmation",
        "vaccination_information",
        "rabies_vaccination",
        "health_certificate",
        "veterinary_examination",
        "traces_reference",
        "breeder_documentation",
        "foundation_documentation",
        "ownership_declaration",
        "sale_agreement",
        "adoption_agreement",
        "transport_authorisation",
        "pickup_authorisation",
        "handover_protocol",
        "other",
      ],
      transport_document_status: [
        "missing",
        "uploaded",
        "under_review",
        "accepted",
        "rejected",
        "expired",
        "not_applicable",
      ],
      transport_party_role: [
        "legal_owner",
        "requester",
        "sender",
        "recipient",
        "payer",
        "pickup_contact",
        "delivery_contact",
      ],
      transport_request_purpose: [
        "own_dog",
        "purchased_puppy",
        "planned_sale",
        "adoption",
        "foundation_rescue",
        "relocation",
        "exhibition",
        "veterinary",
        "other",
      ],
      transport_service_type: [
        "shared",
        "individual",
        "express",
        "vip",
        "recommend_best",
      ],
      transport_status: [
        "draft",
        "submitted",
        "initial_review",
        "missing_information",
        "documents_under_review",
        "quotation_prepared",
        "quotation_sent",
        "accepted_by_customer",
        "awaiting_documents",
        "ready_for_scheduling",
        "scheduled",
        "driver_assigned",
        "pickup_confirmed",
        "animal_collected",
        "in_transport",
        "rest_or_care_stop",
        "approaching_destination",
        "delivered",
        "handover_confirmed",
        "completed",
        "rejected",
        "cancelled_by_customer",
        "cancelled_by_operations",
        "veterinary_hold",
        "compliance_hold",
        "route_postponed",
      ],
      transport_visibility: ["private", "community_visible"],
      verification_status: [
        "not_started",
        "pending",
        "more_information_required",
        "approved",
        "rejected",
        "expired",
        "suspended",
      ],
      verification_type: [
        "email",
        "phone",
        "identity",
        "breeder",
        "organisation",
        "animal_ownership",
        "driver",
        "transport_employee",
      ],
      welfare_case_status: [
        "draft",
        "submitted",
        "under_review",
        "information_required",
        "accepted_for_assessment",
        "declined",
        "converted_to_transport",
        "closed",
      ],
      welfare_case_urgency: ["routine", "urgent", "critical"],
    },
  },
} as const
