import axios, {AxiosResponse} from "axios";
import {Project, ProjectFile, ProjectStatus} from "../projects/ProjectModels";
import {Buffer} from 'buffer';
import {SsoApi} from "./SsoApi";

axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';
const instance = axios.create();

export class KaravanApi {

    static me?: any;
    static basicToken: string = '';
    static authType: string = '';
    static isAuthorized: boolean = false;

    static setAuthType(authType: string) {
        KaravanApi.authType = authType;
        switch (authType){
            case "public": {
                KaravanApi.setPublicAuthentication();
                break;
            }
            case "oidc": {
                KaravanApi.setOidcAuthentication();
                break;
            }
            case "basic": {
                KaravanApi.setBasicAuthentication();
                break;
            }
        }
    }
    static setPublicAuthentication() {

    }
    static setBasicAuthentication() {
        instance.interceptors.request.use(async config => {
                config.headers = {
                    'Authorization': 'Basic ' + KaravanApi.basicToken,
                }
                return config;
            },
            error => {
                Promise.reject(error)
            });
    }
    static setOidcAuthentication() {
        instance.interceptors.request.use(async config => {
                config.headers = {
                    'Authorization': 'Bearer ' + SsoApi.keycloak?.token,
                }
                return config;
            },
            error => {
                Promise.reject(error)
            });

        instance.interceptors.response.use((response) => {
            return response
        }, async function (error) {
            const originalRequest = error.config;
            if ((error?.response?.status === 403 || error?.response?.status === 401) && !originalRequest._retry) {
                console.log("error", error)
                return SsoApi.keycloak?.updateToken(1).then(refreshed => {
                    if (refreshed) {
                        console.log('SsoApi', 'Token was successfully refreshed', SsoApi.keycloak?.token);
                    } else {
                        console.log('SsoApi', 'Token is still valid');
                    }
                    originalRequest._retry = true;
                    return instance(originalRequest);
                }).catch(reason => {
                    console.log('SsoApi', 'Failed to refresh token: ' + reason);
                });
            }
            return Promise.reject(error);
        });
    }

    static async getConfig(after: (config: {}) => void) {
        axios.get('/public/sso-config', {headers: {'Accept': 'application/json'}})
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getAuthType(after: (authType: string) => void) {
        instance.get('/public/auth', {headers: {'Accept': 'text/plain'}})
            .then(res => {
                if (res.status === 200) {
                    KaravanApi.setAuthType(res.data);
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async auth(username: string, password: string, after: (res: any) => void) {
        KaravanApi.basicToken = Buffer.from(username + ":" + password).toString('base64');
        instance.get('/api/users/me')
            .then(res => {
                if (res.status === 200) {
                    KaravanApi.isAuthorized = true;
                    KaravanApi.me = res.data;
                    after(res);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getMe(after: (user: {}) => void) {
        instance.get('/api/users/me')
            .then(res => {
                if (res.status === 200) {
                    KaravanApi.me = res.data;
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getConfiguration(after: (config: {}) => void) {
        instance.get('/api/configuration')
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getProject(projectId: string, after: (project: Project) => void) {
        instance.get('/api/project/' + projectId)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getProjectStatus(projectId: string, after: (status: ProjectStatus) => void) {
        instance.get('/api/status/project/' + projectId)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getProjects(after: (projects: Project[]) => void) {
        instance.get('/api/project')
            .then(res => {
                if (res.status === 200) {
                    after(res.data.map((p: Partial<Project> | undefined) => new Project(p)));
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async postProject(project: Project, after: (res: AxiosResponse<any>) => void) {
        instance.post('/api/project', project)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async copyProject(sourceProject: string, project: Project, after: (res: AxiosResponse<any>) => void) {
        instance.post('/api/project/copy/' + sourceProject, project)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async deleteProject(project: Project, after: (res: AxiosResponse<any>) => void) {
        instance.delete('/project/' + encodeURI(project.projectId),
            {headers: {'username': 'cameleer'}})
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async getFiles(project: string, after: (files: []) => void) {
        instance.get('/api/file/' + project)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async postProjectFile(file: ProjectFile, after: (res: AxiosResponse<any>) => void) {
        instance.post('/api/file', file)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async deleteProjectFile(file: ProjectFile, after: (res: AxiosResponse<any>) => void) {
        instance.delete('/api/file/' + file.projectId + '/' + file.name)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async push(project: Project, after: (res: AxiosResponse<any>) => void) {
        instance.post('/api/git', project)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async pipelineRun(project: Project, environment: string, after: (res: AxiosResponse<any>) => void) {
        instance.post('/api/kubernetes/pipeline/' + environment, project)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async getPipelineLog(environment: string, pipelineRunName: string, after: (res: AxiosResponse<any>) => void) {
        instance.get('/api/kubernetes/pipeline/log/' + environment + "/" + pipelineRunName)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getContainerLog(environment: string, name: string, after: (res: AxiosResponse<string>) => void) {
        instance.get('/api/kubernetes/container/log/' + environment + "/" + name)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async rolloutDeployment(name: string, environment: string, after: (res: AxiosResponse<any>) => void) {
        instance.post('/api/kubernetes/deployment/rollout/' + environment + '/' + name, "")
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async deleteDeployment(environment: string, name: string, after: (res: AxiosResponse<any>) => void) {
        instance.delete('/api/kubernetes/deployment/' + environment + '/' + name)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async deletePod(environment: string, name: string, after: (res: AxiosResponse<any>) => void) {
        instance.delete('/api/kubernetes/pod/' + environment + '/' + name)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async getConfigMaps(environment: string, after: (any: []) => void) {
        instance.get('/api/kubernetes/configmap/' + environment)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getSecrets(environment: string, after: (any: []) => void) {
        instance.get('/api/kubernetes/secret/' + environment)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getServices(environment: string, after: (any: []) => void) {
        instance.get('/api/kubernetes/service/' + environment)
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }


    static async getKameletNames(after: (names: []) => void) {
        instance.get('/api/kamelet')
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getKamelet(name: string, after: (yaml: string) => void) {
        instance.get('/api/kamelet/' + name, {headers: {'Accept': 'text/plain'}})
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getComponentNames(after: (names: []) => void) {
        instance.get('/api/component')
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getComponent(name: string, after: (json: string) => void) {
        instance.get('/api/component/' + name)
            .then(res => {
                if (res.status === 200) {
                    after(JSON.stringify(res.data));
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getOpenApis(after: (openapis: []) => void) {
        instance.get('/api/openapi')
            .then(res => {
                if (res.status === 200) {
                    after(res.data);
                }
            }).catch(err => {
            console.log(err);
        });
    }

    static async getOpenApi(name: string, after: (res: AxiosResponse<any>) => void) {
        instance.get('/api/openapi/' + name, {headers: {'Accept': 'text/plain'}})
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }

    static async postOpenApi(file: ProjectFile, generateRest: boolean, generateRoutes: boolean, integrationName: string, after: (res: AxiosResponse<any>) => void) {
        const uri = `/api/file/openapi/${generateRest}/${generateRoutes}/${integrationName}`;
        instance.post(encodeURI(uri), file)
            .then(res => {
                after(res);
            }).catch(err => {
            after(err);
        });
    }
}