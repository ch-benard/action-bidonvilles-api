const { sequelize } = require('#db/models/index');
const userModel = require('#server/models/userModel')(sequelize);
const organizationModel = require('#server/models/organizationModel')(sequelize);
const organizationTypeModel = require('#server/models/organizationTypeModel')(sequelize);
const { generateSalt } = require('#server/utils/auth');

const sanitize = require('#server/controllers/userController/helpers/sanitize');
const validate = require('#server/controllers/userController/helpers/validate');

async function createUser(data) {
    const userId = await sequelize.transaction(async (t) => {
        // create association if necessary
        if (data.organization_category === 'association') {
            let create = null;
            let organization = null;
            if (data.association === 'Autre') {
                create = {
                    name: data.newAssociationName,
                    abbreviation: data.newAssociationAbbreviation || null,
                };
            } else {
                organization = await organizationModel.findOneAssociation(
                    data.association,
                    data.departement,
                );

                if (organization === null) {
                    const association = await organizationModel.findAssociationName(data.association);

                    create = {
                        name: association !== null ? association.name : data.association,
                        abbreviation: association !== null ? association.abbreviation : null,
                    };
                }
            }

            if (create !== null) {
                const type = (await organizationTypeModel.findByCategory('association'))[0].id;
                [[organization]] = (await organizationModel.create(
                    create.name,
                    create.abbreviation,
                    type,
                    null,
                    data.departement,
                    null,
                    null,
                    false,
                    t,
                ));
            }

            Object.assign(data, { organization: organization.id });
        }

        // create the user himself
        return userModel.create(Object.assign(data, {
            salt: generateSalt(),
        }), t);
    });

    return userModel.findOne(userId);
}

async function validateCreationInput(rawData, extendedFields = []) {
    // get the list of fields to be validated
    const fields = [
        ...[
            { key: 'last_name', sanitizer: 'string' },
            { key: 'first_name', sanitizer: 'string' },
            { key: 'email', sanitizer: 'string' },
            { key: 'organization_category', sanitizer: 'string' },
            { key: 'position', sanitizer: 'string' },
            { key: 'legal', sanitizer: 'bool' },
        ],
        ...extendedFields,
    ];

    const specificFields = {
        public_establishment() {
            return [
                { key: 'organization_type', sanitizer: 'integer' },
                { key: 'organization_public', sanitizer: 'integer' },
            ];
        },

        territorial_collectivity() {
            return [
                { key: 'territorial_collectivity', sanitizer: 'object' },
            ];
        },

        association() {
            return [
                { key: 'association', sanitizer: 'string' },
                { key: 'newAssociationName', sanitizer: 'string' },
                { key: 'newAssociationAbbreviation', sanitizer: 'string' },
                { key: 'departement', sanitizer: 'string' },
            ];
        },

        administration() {
            return [
                { key: 'organization_administration', sanitizer: 'integer' },
            ];
        },
    };

    if (Object.prototype.hasOwnProperty.call(specificFields, rawData.organization_category)) {
        fields.push(...specificFields[rawData.organization_category]());
    }

    // sanitize
    const sanitizedData = sanitize(rawData, fields);

    // validate
    return {
        sanitizedData,
        errors: await validate(sanitizedData, fields),
    };
}

const userService = {};
userService.create = async (data, extendedFields, createdBy = null) => {
    // validate input
    const { sanitizedData, errors } = await validateCreationInput(data, extendedFields);

    if (Object.keys(errors).length > 0) {
        return {
            error: {
                code: 400,
                response: {
                    error: {
                        user_message: 'Certaines informations saisies sont incorrectes',
                        developer_message: 'Input data is invalid',
                        fields: errors,
                    },
                },
            },
        };
    }

    // insert user into database
    try {
        return await createUser(Object.assign({}, sanitizedData, {
            created_by: createdBy,
        }));
    } catch (error) {
        return {
            error: {
                code: 500,
                response: {
                    error: {
                        user_message: 'Une erreur est survenue lors de l\'écriture en base de données',
                        developer_message: 'Failed inserting the new user into database',
                    },
                },
            },
        };
    }
};

module.exports = userService;