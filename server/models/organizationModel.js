module.exports = database => ({
    findByCategory: (categoryUid, search = null) => database.query(
        `SELECT
            organizations.organization_id AS id,
            organizations.name,
            organizations.location_type,
            organizations."region_code",
            organizations."region_name",
            organizations."departement_code",
            organizations."departement_name",
            organizations."epci_code",
            organizations."epci_name",
            organizations."city_code",
            organizations."city_name"
        FROM localized_organizations AS organizations
        LEFT JOIN organization_types ON organizations.fk_type = organization_types.organization_type_id
        WHERE
            organization_types.fk_category = :categoryUid
            AND
            organizations.active = TRUE
            ${search !== null ? ' AND (organizations.name ILIKE :search OR organizations.abbreviation ILIKE :search)' : ''}
        ORDER BY region_code ASC, departement_code ASC, epci_name ASC, city_name ASC`,
        {
            type: database.QueryTypes.SELECT,
            replacements: {
                categoryUid,
                search: `%${search}%`,
            },
        },
    ),

    findByType: typeId => database.query(
        `SELECT
            organization_id AS id,
            name,
            location_type,
            "region_code",
            "region_name",
            "departement_code",
            "departement_name",
            "epci_code",
            "epci_name",
            "city_code",
            "city_name"
        FROM localized_organizations
        WHERE fk_type = :typeId AND active = TRUE
        ORDER BY departement_code ASC, region_name ASC, epci_name ASC, city_name ASC`,
        {
            type: database.QueryTypes.SELECT,
            replacements: {
                typeId,
            },
        },
    ),

    findOneById: async (id) => {
        const result = await database.query(
            `SELECT
                organizations.organization_id AS id,
                organizations.name,
                organizations.fk_type,
                organization_types.fk_category
            FROM organizations
            LEFT JOIN organization_types ON organizations.fk_type = organization_types.organization_type_id
            WHERE organizations.organization_id = :id AND organizations.active = TRUE`,
            {
                type: database.QueryTypes.SELECT,
                replacements: {
                    id,
                },
            },
        );

        return result.length === 1 ? result[0] : null;
    },

    findOneByLocation: async (typeName, typeLevel, code) => {
        const result = await database.query(
            `SELECT
                organizations.organization_id AS id,
                organizations.name,
                organization_types.fk_category
            FROM localized_organizations AS organizations
            LEFT JOIN
                organization_types ON organizations.fk_type = organization_types.organization_type_id
            WHERE
                organization_types.name_singular = :typeName
                AND
                organizations.${typeLevel}_code = :code
                AND
                organizations.active = TRUE`,
            {
                type: database.QueryTypes.SELECT,
                replacements: {
                    typeName,
                    code,
                },
            },
        );
        return result.length === 1 ? result[0] : null;
    },

    findAssociationName: async (name) => {
        const result = await database.query(
            `SELECT
                organizations.name,
                organizations.abbreviation
            FROM localized_organizations AS organizations
            LEFT JOIN
                organization_types ON organizations.fk_type = organization_types.organization_type_id
            WHERE
                organization_types.fk_category = 'association'
                AND
                organizations.name ILIKE :name`,
            {
                type: database.QueryTypes.SELECT,
                replacements: {
                    name,
                },
            },
        );
        return result.length > 0 ? result[0] : null;
    },

    findOneAssociation: async (name, code) => {
        const result = await database.query(
            `SELECT
                organizations.organization_id AS id,
                organizations.name,
                organization_types.fk_category
            FROM localized_organizations AS organizations
            LEFT JOIN
                organization_types ON organizations.fk_type = organization_types.organization_type_id
            WHERE
                organization_types.fk_category = 'association'
                AND
                organizations.name ILIKE :name
                AND
                organizations.departement_code = :code`,
            {
                type: database.QueryTypes.SELECT,
                replacements: {
                    name,
                    code,
                },
            },
        );
        return result.length === 1 ? result[0] : null;
    },

    create: (name, abbreviation = null, type, region = null, departement = null, epci = null, city = null, active = false, transaction = undefined) => database.query(
        `INSERT INTO
            organizations(name, abbreviation, fk_type, fk_region, fk_departement, fk_epci, fk_city, active)
        VALUES
            (:name, :abbreviation, :type, :region, :departement, :epci, :city, :active)
        RETURNING organization_id AS id`,
        {
            replacements: {
                name,
                abbreviation,
                type,
                region,
                departement,
                epci,
                city,
                active,
            },
            transaction,
        },
    ),

    activate(organizationId) {
        return database.query('UPDATE organizations SET active = TRUE WHERE organization_id = :organizationId', {
            replacements: {
                organizationId,
            },
        });
    },

    async setCustomPermissions(organizationId, permissions) {
        return database.transaction(t => database.query('DELETE FROM permissions WHERE fk_organization = :organizationId', {
            transaction: t,
            replacements: {
                organizationId,
            },
        })
            .then(() => Promise.all(
                permissions.map(permission => database.query(
                    `INSERT INTO
                            permissions(fk_organization, fk_role_admin, fk_role_regular, fk_feature, fk_entity, allowed, fk_geographic_level)
                        VALUES
                            (:organizationId, NULL, NULL, :feature, :entity, :allowed, :level)
                        RETURNING permission_id`,
                    {
                        transaction: t,
                        replacements: {
                            organizationId,
                            feature: permission.feature,
                            entity: permission.entity,
                            level: permission.level,
                            allowed: permission.allowed,
                        },
                    },
                )
                    .then(([[{ permission_id: permissionId }]]) => {
                        const replacements = Object.assign({ fk_permission: permissionId }, permission.data || {});
                        return database.query(
                            `INSERT INTO ${permission.entity}_permissions VALUES (${Object.keys(replacements).map(name => `:${name}`).join(',')})`,
                            {
                                transaction: t,
                                replacements,
                            },
                        );
                    })),
            )));
    },
});
